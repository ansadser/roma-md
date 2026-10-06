import "dotenv/config";

export const config={
  port:Number(process.env.PORT||process.env.WEB_PORT||10000),
  prefix:process.env.PREFIX||".",
  mode:(process.env.MODE||"public").toLowerCase()==="private"?"private":"public",
  owner:(process.env.OWNER_NUMBER||"").replace(/\D/g,""),
  botName:process.env.BOT_NAME||"ROMA MD",
  language:process.env.LANGUAGE||"English",
  sessionId:String(process.env.SESSION_ID||"").trim(),
  mongodbUri:String(process.env.MONGODB_URI||"").trim(),
  sessionEncryptionKey:String(process.env.SESSION_ENCRYPTION_KEY||"").trim()
};
