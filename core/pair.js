import makeWASocket,{Browsers,DisconnectReason,useMultiFileAuthState} from "@whiskeysockets/baileys";
import {Boom} from "@hapi/boom";
import QRCode from "qrcode";
import fs from "node:fs/promises";
import {config} from "../config.js";

let sock=null;
let reconnecting=false;
let messageHandler=null;

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
export async function connectionInfo(){return {connected:state.status==="connected",status:state.status,userJid:state.userJid,pairingCode:state.pairingCode||"",hasQr:!!state.qr,qr:state.qrDataUrl||null}}
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

export async function requestPairingCode(phone){
  if(!sock)throw new Error("WhatsApp socket is not ready");
  if(state.status==="connected"||sock.authState?.creds?.registered)throw new Error("Already connected");
  const number=String(phone||"").replace(/\D/g,"");
  if(!/^\d{7,15}$/.test(number))throw new Error("Enter a valid phone number with country code");
  const started=Date.now();
  while(!state.qr&&state.status!=="connected"&&Date.now()-started<15000){await new Promise(r=>setTimeout(r,250));}
  if(state.status==="connected"||sock.authState?.creds?.registered)throw new Error("Already connected");
  if(!state.qr)throw new Error("WhatsApp connection is not ready yet. Wait a few seconds and try again.");
  const code=await sock.requestPairingCode(number);
  state.pairingCode=String(code||"").replace(/(.{4})/,"$1-");
  return state.pairingCode;
}

async function clearAuth(){try{await fs.rm(config.authDir,{recursive:true,force:true})}catch{}}

export async function startWhatsApp(){
  if(reconnecting)return;
  reconnecting=true;
  try{
    await fs.mkdir(config.authDir,{recursive:true});
    const {state:authState,saveCreds}=await useMultiFileAuthState(config.authDir);
    sock=makeWASocket({
      auth:authState,
      browser:Browsers.ubuntu(config.botName),
      markOnlineOnConnect:false,
      syncFullHistory:false,
      printQRInTerminal:false
    });
    state.status=authState.creds.registered?"connecting":"waiting";
    state.lastError="";
    state.pairingCode=null;
    sock.ev.on("creds.update",saveCreds);

    sock.ev.on("connection.update",async({connection,lastDisconnect,qr})=>{
      if(qr&&!authState.creds.registered){
        state.status="waiting"; state.qr=qr;
        try{state.qrDataUrl=await QRCode.toDataURL(qr,{width:280,margin:2})}catch{state.qrDataUrl=null}
      }
      if(connection==="open"){
        state.status="connected";state.qr=null;state.qrDataUrl=null;state.pairingCode=null;
        state.userJid=normalizeJid(sock.user?.id||"");
        console.log("[ROMA] WhatsApp connected as "+state.userJid);
      }
      if(connection==="close"){
        state.qr=null;state.qrDataUrl=null;
        const code=lastDisconnect?.error instanceof Boom?lastDisconnect.error.output?.statusCode:lastDisconnect?.error?.output?.statusCode;
        const loggedOut=code===DisconnectReason.loggedOut;
        state.status=loggedOut?"logged_out":"reconnecting";
        state.lastError=String(lastDisconnect?.error?.message||"Connection closed");
        console.log("[ROMA] WhatsApp connection closed: "+state.lastError);
        if(loggedOut){await clearAuth();state.status="waiting"}
        reconnecting=false;setTimeout(()=>startWhatsApp().catch(console.error),loggedOut?500:1500);
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
    setTimeout(()=>startWhatsApp().catch(console.error),3000);return;
  }
  reconnecting=false;
}