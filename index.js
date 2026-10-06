import {config} from "./config.js";
import {getBotJid,onMessage,startWhatsApp,sendMessage} from "./core/pair.js";
import {loadPlugins} from "./core/plugin.js";
import {startWebServer} from "./core/web.js";

const started=Date.now();
let plugins=[];

const numberOf=v=>String(v||"").split("@")[0].split(":")[0].replace(/\D/g,"");
const uptime=()=>{let s=Math.floor((Date.now()-started)/1000),h=Math.floor(s/3600);s%=3600;let m=Math.floor(s/60);return String(h).padStart(2,"0")+":"+String(m).padStart(2,"0")+":"+String(s%60).padStart(2,"0")};

async function allowed(sender){
  if(config.mode!=="private")return true;
  const bot=numberOf(await getBotJid());
  return !!sender&&(sender===bot||!!config.owner&&sender===config.owner);
}

async function handle(m){
  const text=String(m?.text||"").trim();
  if(!text.startsWith(config.prefix))return;
  const sender=numberOf(m.sender||m.from);
  if(!(await allowed(sender)))return;

  const receivedAt=Date.now();
  const parts=text.slice(config.prefix.length).trim().split(/\s+/);
  const name=(parts.shift()||"").toLowerCase();
  const arg=parts.join(" ");
  const command=plugins.find(p=>p.name===name||(p.aliases||[]).includes(name));
  if(!command)return;

  const date=new Date();
  const ctx={
    message:m,config,senderNumber:sender,arg,args:parts,receivedAt,pluginCount:plugins.length,
    date:date.toLocaleDateString("en-GB",{day:"numeric",month:"numeric",year:"numeric"}),
    time:date.toLocaleTimeString("en-US"),uptime,
    reply:(replyText,mentions=[])=>sendMessage(m.from,replyText,mentions)
  };
  await command.run(ctx);
}

async function main(){
  plugins=await loadPlugins();
  startWebServer();
  onMessage(handle);
  await startWhatsApp();
  console.log("[ROMA] Bot started • Plugins: "+plugins.length);
}
main().catch(e=>{console.error("[ROMA] Fatal:",e);process.exit(1)});