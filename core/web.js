import http from "node:http";
import {config} from "../config.js";
import {requestPairingCode,sessionInfo,state} from "./pair.js";

const html=String.raw\`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>ROMA MD • Connect</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#fff;font-family:Inter,system-ui,sans-serif}
.card{width:min(430px,92vw);padding:28px;border:1px solid #27272a;border-radius:24px;background:#111113;box-shadow:0 20px 80px #0008;text-align:center}
h1{margin:0 0 8px;font-size:28px}.muted{color:#a1a1aa;font-size:14px}.status{margin:18px 0;padding:10px;border-radius:12px;background:#18181b}
#qr{width:280px;height:280px;background:#fff;border-radius:16px;padding:8px;margin:14px auto;display:none}
input{width:100%;padding:13px 14px;border-radius:12px;border:1px solid #3f3f46;background:#18181b;color:#fff;font-size:16px;outline:none}
button{width:100%;margin-top:10px;padding:13px;border:0;border-radius:12px;background:#fff;color:#09090b;font-weight:700;cursor:pointer}
.code{font-size:28px;letter-spacing:5px;font-weight:800;margin:18px 0;min-height:34px}
.ok{color:#4ade80}.warn{color:#facc15}.err{color:#fb7185}
small{display:block;margin-top:14px;color:#71717a;line-height:1.5}
</style></head><body><main class="card">
<h1>🤖 ROMA MD</h1><div class="muted">WhatsApp connection</div>
<div id="status" class="status">Starting...</div>
<img id="qr" alt="WhatsApp QR">
<div id="pairArea">
<input id="phone" inputmode="numeric" placeholder="Phone number + country code">
<button id="pair">Get Pairing Code</button>
<div id="code" class="code"></div>
</div>
<small>QR scan: WhatsApp → Linked devices → Link a device.<br>Pairing: Linked devices → Link with phone number instead.</small>
</main>
<script>
const $=id=>document.getElementById(id);
async function refresh(){
 try{
  const d=await fetch('/api/status',{cache:'no-store'}).then(r=>r.json());
  $('status').textContent=d.status==='connected'?'🟢 Connected':d.status==='waiting'?'🟡 Waiting for WhatsApp':'🔄 '+d.status;
  $('status').className='status '+(d.status==='connected'?'ok':d.status==='error'?'err':'warn');
  $('qr').style.display=d.qr?'block':'none';if(d.qr)$('qr').src=d.qr;
  $('pairArea').style.display=d.status==='connected'?'none':'block';
  if(d.pairingCode)$('code').textContent=d.pairingCode;
 }catch(e){}
}
$('pair').onclick=async()=>{
 const phone=$('phone').value.replace(/\\D/g,'');
 if(!phone)return alert('Enter phone number with country code');
 $('pair').disabled=true;$('pair').textContent='Generating...';
 try{
  const d=await fetch('/api/pair',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({phone})}).then(r=>r.json());
  if(!d.ok)throw new Error(d.error);$('code').textContent=d.code;
 }catch(e){alert(e.message||'Pairing failed')}
 finally{$('pair').disabled=false;$('pair').textContent='Get Pairing Code'}
};
refresh();setInterval(refresh,1500);
</script></body></html>\`;

function authorized(req){
  if(!config.webToken)return true;
  const auth=String(req.headers.authorization||"");
  const url=new URL(req.url,"http://localhost");
  return auth==="Bearer "+config.webToken||url.searchParams.get("token")===config.webToken;
}

export function startWebServer(){
  const server=http.createServer(async(req,res)=>{
    try{
      if(!authorized(req)){res.writeHead(401,{"content-type":"text/plain"});return res.end("Unauthorized")}
      const url=new URL(req.url,"http://localhost");
      if(req.method==="GET"&&url.pathname==="/"){
        res.writeHead(200,{"content-type":"text/html; charset=utf-8"});return res.end(html);
      }
      if(req.method==="GET"&&url.pathname==="/api/status"){
        res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify(await sessionInfo()));
      }
      if(req.method==="POST"&&url.pathname==="/api/pair"){
        let body="";for await(const chunk of req)body+=chunk;
        const data=JSON.parse(body||"{}");const code=await requestPairingCode(data.phone);
        res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,code}));
      }
      if(req.method==="GET"&&url.pathname==="/health"){
        res.writeHead(200,{"content-type":"application/json"});return res.end(JSON.stringify({ok:true,status:state.status}));
      }
      res.writeHead(404,{"content-type":"text/plain"});res.end("Not found");
    }catch(e){
      res.writeHead(400,{"content-type":"application/json"});res.end(JSON.stringify({ok:false,error:String(e?.message||e)}));
    }
  });
  server.listen(config.port,"0.0.0.0",()=>console.log("[ROMA] Web panel on port "+config.port));
  return server;
}
