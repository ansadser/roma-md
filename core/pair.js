import makeWASocket,{DisconnectReason,makeCacheableSignalKeyStore,fetchLatestWaWebVersion,initAuthCreds} from "@whiskeysockets/baileys";
import {Boom} from "@hapi/boom";
import crypto from "node:crypto";
import mongoose from "mongoose";
import pino from "pino";
import {config} from "../config.js";

let sock=null;
let reconnecting=false;
let messageHandler=null;
let mongoReady=false;

export const state={status:"starting",qr:null,qrDataUrl:null,pairingCode:null,userJid:"",lastError:""};

const normalizeJid=jid=>String(jid||"").replace(/:.*?(?=@)/,"");

function unwrap(m){
  let msg=m?.message||{};
  if(msg.ephemeralMessage?.message)msg=msg.ephemeralMessage.message;
  if(msg.viewOnceMessage?.message)msg=msg.viewOnceMessage.message;
  return msg;
}
function textOf(m){
  const msg=unwrap(m);
  return String(msg.conversation||msg.extendedTextMessage?.text||msg.imageMessage?.caption||msg.videoMessage?.caption||msg.documentMessage?.caption||"").trim();
}
function normalizeMessage(m){
  const from=normalizeJid(m?.key?.remoteJid);
  const sender=normalizeJid(m?.key?.participant||m?.key?.remoteJid);
  return {id:m?.key?.id||"",from,sender,participant:sender,fromMe:!!m?.key?.fromMe,text:textOf(m),message:m?.message||{},key:m?.key||{},raw:m};
}
export function onMessage(fn){messageHandler=fn}
export function getSocket(){return sock}
export function isGroupJid(jid){return String(jid||"").endsWith("@g.us")}
export async function connectionInfo(){return {connected:state.status==="connected",status:state.status,userJid:state.userJid,sessionId:config.sessionId,lastError:state.lastError}}
export async function getBotJid(){return state.userJid}

export async function sendMessage(to,text,mentions=[]){
  if(!sock)throw new Error("WhatsApp socket is not ready");
  return sock.sendMessage(to,{text:String(text)},mentions?.length?{mentions}:undefined);
}
export async function sendImage(to,url,caption=""){
  if(!sock)throw new Error("WhatsApp socket is not ready");
  return sock.sendMessage(to,{image:{url},caption:String(caption||"")});
}
export async function sendVideo(to,url,caption=""){
  if(!sock)throw new Error("WhatsApp socket is not ready");
  return sock.sendMessage(to,{video:{url},caption:String(caption||"")});
}
export async function sendAudio(to,url,caption=""){
  if(!sock)throw new Error("WhatsApp socket is not ready");
  return sock.sendMessage(to,{audio:{url},mimetype:"audio/mpeg",caption:String(caption||"")});
}

function encrypt(value){
  const key=Buffer.from(config.sessionEncryptionKey,"hex");
  const iv=crypto.randomBytes(12);
  const cipher=crypto.createCipheriv("aes-256-gcm",key,iv);
  const body=Buffer.concat([cipher.update(Buffer.from(value)),cipher.final()]);
  return Buffer.concat([iv,cipher.getAuthTag(),body]).toString("base64url");
}
function decrypt(value){
  const raw=Buffer.from(value,"base64url");
  if(raw.length<29)throw new Error("Invalid encrypted auth value");
  const decipher=crypto.createDecipheriv("aes-256-gcm",Buffer.from(config.sessionEncryptionKey,"hex"),raw.subarray(0,12));
  decipher.setAuthTag(raw.subarray(12,28));
  return Buffer.concat([decipher.update(raw.subarray(28)),decipher.final()]).toString();
}
function safeJson(value){
  return JSON.stringify(value,(_,v)=>Buffer.isBuffer(v)?{type:"Buffer",data:[...v]}:v);
}
function reviveJson(value){
  return JSON.parse(value,(_,v)=>v&&v.type==="Buffer"&&Array.isArray(v.data)?Buffer.from(v.data):v);
}

const AuthSchema=new mongoose.Schema({
  sessionId:{type:String,index:true},category:String,key:String,value:String,updatedAt:{type:Date,default:Date.now}
},{collection:"roma_auth"});
AuthSchema.index({sessionId:1,category:1,key:1},{unique:true});
const Auth=mongoose.models.RomaAuth||mongoose.model("RomaAuth",AuthSchema);

async function saveAuth(sessionId,category,key,value){
  await Auth.findOneAndUpdate(
    {sessionId,category,key},
    {$set:{value:encrypt(safeJson(value)),updatedAt:new Date()}},
    {upsert:true,new:true}
  );
}
async function loadAuth(sessionId,category,key){
  const doc=await Auth.findOne({sessionId,category,key}).lean();
  return doc?reviveJson(decrypt(doc.value)):null;
}
async function deleteAuth(){
  await Auth.deleteMany({sessionId:config.sessionId});
}

async function createAuthState(){
  const storedCreds=await loadAuth(config.sessionId,"creds","creds");
  const authState={
    creds:storedCreds||initAuthCreds(),
    keys:{
      get:async(type,ids)=>{
        const result={};
        for(const id of ids)result[id]=await loadAuth(config.sessionId,"key",type+":"+id);
        return result;
      },
      set:async data=>{
        const writes=[];
        for(const [type,values] of Object.entries(data))
          for(const [id,value] of Object.entries(values))
            writes.push(saveAuth(config.sessionId,"key",type+":"+id,value));
        await Promise.all(writes);
      }
    }
  };
  return {state:authState,saveCreds:()=>saveAuth(config.sessionId,"creds","creds",authState.creds)};
}

async function ensureMongo(){
  if(mongoReady)return;
  if(!config.mongodbUri)throw new Error("MONGODB_URI is required");
  if(!/^[0-9a-fA-F]{64}$/.test(config.sessionEncryptionKey))throw new Error("SESSION_ENCRYPTION_KEY must be exactly 64 hexadecimal characters");
  if(!config.sessionId.startsWith("ROMA~"))throw new Error("SESSION_ID must start with ROMA~");
  await mongoose.connect(config.mongodbUri);
  mongoReady=true;
  console.log("[ROMA] MongoDB session store connected");
}

export async function startWhatsApp(){
  if(reconnecting)return;
  reconnecting=true;
  try{
    await ensureMongo();
    const {state:authState,saveCreds}=await createAuthState();
    const versionResult=await fetchLatestWaWebVersion().catch(()=>null);
    const version=versionResult?.version;
    sock=makeWASocket({
      ...(version?{version}:{}),
      auth:{creds:authState.creds,keys:makeCacheableSignalKeyStore(authState.keys,pino({level:"silent"}))},
      printQRInTerminal:false,
      logger:pino({level:"silent"}),
      connectTimeoutMs:60000,
      qrTimeout:60000,
      defaultQueryTimeoutMs:60000,
      markOnlineOnConnect:false,
      syncFullHistory:false
    });
    state.status=authState.creds.registered?"connecting":"error";
    state.lastError=authState.creds.registered?"":"No saved credentials found for SESSION_ID";
    sock.ev.on("creds.update",saveCreds);

    sock.ev.on("connection.update",async({connection,lastDisconnect})=>{
      if(connection==="open"){
        state.status="connected";state.lastError="";
        state.userJid=normalizeJid(sock.user?.id||"");
        console.log("[ROMA] WhatsApp connected as "+state.userJid);
      }
      if(connection==="close"){
        const code=lastDisconnect?.error instanceof Boom?lastDisconnect.error.output?.statusCode:lastDisconnect?.error?.output?.statusCode;
        const loggedOut=code===DisconnectReason.loggedOut;
        state.status=loggedOut?"logged_out":"reconnecting";
        state.lastError=String(lastDisconnect?.error?.message||"Connection closed");
        console.log("[ROMA] WhatsApp connection closed: "+state.lastError);
        sock=null;
        if(loggedOut){await deleteAuth();state.status="logged_out";reconnecting=false;return;}
        reconnecting=false;
        setTimeout(()=>startWhatsApp().catch(console.error),1500);
      }
    });

    sock.ev.on("messages.upsert",async({messages,type})=>{
      if(type!=="notify"||!messageHandler)return;
      for(const raw of messages||[]){
        if(raw?.key?.fromMe)continue;
        const m=normalizeMessage(raw);
        if(!m.from||!m.text)continue;
        try{await messageHandler(m)}catch(e){console.error("[ROMA] message handler:",e?.message||e)}
      }
    });
  }catch(e){
    state.status="error";state.lastError=String(e?.message||e);reconnecting=false;
    console.error("[ROMA] WhatsApp start failed: "+state.lastError);
  }
  reconnecting=false;
}
