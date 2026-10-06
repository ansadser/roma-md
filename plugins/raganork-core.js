import {getSocket,sendMessage,sendImage} from "../core/pair.js";

const botJid=()=>getSocket()?.user?.id||"";
const groupOnly=ctx=>String(ctx.message?.from||"").endsWith("@g.us");

async function meta(ctx){
  if(!groupOnly(ctx)) throw new Error("Group command only");
  return ctx.socket?.groupMetadata ? ctx.socket.groupMetadata(ctx.message.from) : getSocket().groupMetadata(ctx.message.from);
}
function sender(ctx){return String(ctx.senderNumber||"").replace(/\D/g,"")+"@s.whatsapp.net"}
function mentioned(ctx){
  const p=ctx.message?.key?.participant||ctx.message?.key?.remoteJid;
  return p?String(p).replace(/:.*?(?=@)/,""):sender(ctx);
}
async function admins(ctx){
  const m=await meta(ctx);
  return (m.participants||[]).filter(x=>x.admin).map(x=>String(x.id).replace(/:.*?(?=@)/,""));
}
async function requireAdmin(ctx){
  const a=await admins(ctx);
  const me=String(ctx.message?.key?.participant||ctx.message?.key?.remoteJid||"").replace(/:.*?(?=@)/,"");
  if(!a.includes(me)&&!a.includes(String(getSocket()?.user?.id||"").replace(/:.*?(?=@)/,""))) throw new Error("Admin only");
}
function target(ctx){
  const raw=ctx.arg?.trim();
  if(raw){
    const n=raw.replace(/\D/g,"");
    if(n.length>=7)return n+"@s.whatsapp.net";
  }
  return mentioned(ctx);
}

export const commands=[
{name:"list",aliases:["commands"],async run(ctx){
  return ctx.reply("╭━━━〔 ROMA MD 〕━━━\n┃ Plugins: "+ctx.pluginCount+"\n┃ Prefix: "+ctx.config.prefix+"\n╰━━━━━━━━━━━━━━━\n\nUse "+ctx.config.prefix+"menu to view commands.");
}},
{name:"jid",aliases:["id"],async run(ctx){return ctx.reply("🆔 "+(ctx.message.from||""))}},
{name:"tag",aliases:["tagall"],async run(ctx){
  await requireAdmin(ctx);
  const m=await meta(ctx);
  const ids=(m.participants||[]).map(x=>String(x.id).replace(/:.*?(?=@)/,""));
  const text=ctx.arg?.trim()||"📢 Mention all";
  return ctx.reply(text,ids.map(x=>x+"@s.whatsapp.net"));
}},
{name:"promote",aliases:["admin"],async run(ctx){
  await requireAdmin(ctx); const s=getSocket(); const t=target(ctx);
  await s.groupParticipantsUpdate(ctx.message.from,[t],"promote"); return ctx.reply("👑 Promoted.");
}},
{name:"demote",aliases:["unadmin"],async run(ctx){
  await requireAdmin(ctx); const s=getSocket(); const t=target(ctx);
  await s.groupParticipantsUpdate(ctx.message.from,[t],"demote"); return ctx.reply("⬇️ Demoted.");
}},
{name:"kick",aliases:["remove"],async run(ctx){
  await requireAdmin(ctx); const s=getSocket(); const t=target(ctx);
  await s.groupParticipantsUpdate(ctx.message.from,[t],"remove"); return ctx.reply("👋 Removed.");
}},
{name:"add",aliases:["invite"],async run(ctx){
  await requireAdmin(ctx); const s=getSocket(); const n=String(ctx.arg||"").replace(/\D/g,"");
  if(!n)return ctx.reply("❌ Number kodukkuka.");
  await s.groupParticipantsUpdate(ctx.message.from,[n+"@s.whatsapp.net"],"add"); return ctx.reply("✅ Added.");
}},
{name:"mute",aliases:["glock"],async run(ctx){
  await requireAdmin(ctx); await getSocket().groupSettingUpdate(ctx.message.from,"announcement"); return ctx.reply("🔒 Group muted.");
}},
{name:"unmute",aliases:["gunlock"],async run(ctx){
  await requireAdmin(ctx); await getSocket().groupSettingUpdate(ctx.message.from,"not_announcement"); return ctx.reply("🔓 Group unmuted.");
}},
{name:"gname",aliases:["setname"],async run(ctx){
  await requireAdmin(ctx); const v=ctx.arg?.trim(); if(!v)return ctx.reply("❌ New group name kodukkuka.");
  await getSocket().groupUpdateSubject(ctx.message.from,v); return ctx.reply("✅ Group name updated.");
}},
{name:"gdesc",aliases:["setdesc"],async run(ctx){
  await requireAdmin(ctx); const v=ctx.arg?.trim(); if(!v)return ctx.reply("❌ Description kodukkuka.");
  await getSocket().groupUpdateDescription(ctx.message.from,v); return ctx.reply("✅ Group description updated.");
}},
{name:"invite",aliases:["grouplink"],async run(ctx){
  await requireAdmin(ctx); const code=await getSocket().groupInviteCode(ctx.message.from); return ctx.reply("🔗 https://chat.whatsapp.com/"+code);
}},
{name:"revoke",aliases:["resetlink"],async run(ctx){
  await requireAdmin(ctx); const code=await getSocket().groupRevokeInvite(ctx.message.from); return ctx.reply("🔄 Link revoked.");
}},
{name:"leave",aliases:["exit"],async run(ctx){
  await requireAdmin(ctx); await getSocket().groupLeave(ctx.message.from);
}},
{name:"gstatus",aliases:["groupinfo"],async run(ctx){
  const m=await meta(ctx); return ctx.reply("👥 *"+(m.subject||"Group")+"*\nMembers: "+(m.participants?.length||0)+"\nJID: "+ctx.message.from);
}},
{name:"owner",aliases:["sudo"],async run(ctx){return ctx.reply("👑 *Owner:* "+(ctx.config.owner||"Not configured"))}},
{name:"mode",aliases:[],async run(ctx){return ctx.reply("🔐 *Mode:* "+ctx.config.mode)}},
{name:"info",aliases:["botinfo"],async run(ctx){return ctx.reply("🤖 *"+ctx.config.botName+"*\n⚙️ Prefix: "+ctx.config.prefix+"\n🧩 Plugins: "+ctx.pluginCount+"\n⏱️ "+ctx.uptime())}}
];
