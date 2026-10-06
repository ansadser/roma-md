import "dotenv/config";

export const config={
  port:Number(process.env.PORT||process.env.WEB_PORT||10000),
  prefix:process.env.PREFIX||".",
  mode:(process.env.MODE||"public").toLowerCase()==="private"?"private":"public",
  owner:(process.env.OWNER_NUMBER||"").replace(/\D/g,"916235141727"),
  botName:process.env.BOT_NAME||"ROMA MD",
  language:process.env.LANGUAGE||"English",
  sessionId:String(process.env.SESSION_ID||"").trim(),
  mongodbUri:String(process.env.MONGODB_URI||"mongodb+srv://atextnow837_db_user:aLUNnav2f7RhQAjB@cluster0.jxu0bri.mongodb.net/?appName=Cluster0").trim(),
  sessionEncryptionKey:String(process.env.SESSION_ENCRYPTION_KEY||"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef").trim()
};
