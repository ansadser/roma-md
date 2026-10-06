import {sessionInfo} from "../core/pair.js";

export const commands=[{
  name:"session",
  aliases:["sess","sessioninfo"],
  async run(ctx){
    try{
      const d=await sessionInfo();
      return ctx.reply(
        "╭━━〔 *CONNECTION* 〕━━╮\n"+
        "┃ Status : "+(d.connected?"🟢 Connected":"🔴 Disconnected")+"\n"+
        "┃ JID    : "+(d.userJid||"Unknown")+"\n"+
        "╰━━━━━━━━━━━━━━╯"
      );
    }catch(e){
      console.error("[ROMA] connection command:",e?.message||e);
      return ctx.reply("❌ Connection status fetch failed.");
    }
  }
}];