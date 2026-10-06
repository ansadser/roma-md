import "dotenv/config";

export const config={
  authDir:String(process.env.AUTH_DIR||"./auth_info_baileys").trim(),
  port:Number(process.env.PORT||process.env.WEB_PORT||10000),
  prefix:process.env.PREFIX||".",
  mode:(process.env.MODE||"public").toLowerCase()==="private"?"private":"public",
  owner:(process.env.OWNER_NUMBER||"").replace(/\D/g,""),
  botName:process.env.BOT_NAME||"ROMA MD",
  language:process.env.LANGUAGE||"English",
  webToken:String(process.env.WEB_TOKEN||"").trim()
};