import {MAX_MESSAGE_LENGTH,MESSAGE_TOO_LONG} from '../message-limits.mjs';
import {request} from 'node:http';
import {frontendPort, backendPort} from '../ports.mjs';
import {installFileManagement} from './files.mjs';
import {installAuth} from './auth.mjs';
import express from 'express';
import multer from 'multer';
import {DatabaseSync} from 'node:sqlite';
import {mkdirSync, openSync, readSync, closeSync, unlinkSync} from 'node:fs';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {networkInterfaces} from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const data = resolve(process.env.CHAT_DATA || join(root,'backend/data'));
const uploads = join(data,'uploads');
mkdirSync(uploads,{recursive:true});
const db = new DatabaseSync(join(data,'chat.sqlite'));
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS messages (
 id INTEGER PRIMARY KEY, device TEXT NOT NULL, name TEXT NOT NULL,
 text TEXT NOT NULL, file TEXT, mime TEXT, filename TEXT, time INTEGER NOT NULL
)`);
const app = express();
app.use('/api',(req,res,next)=>{
  const origin=req.get('origin');
  if(origin && origin !== 'http://'+req.get('host') && origin !== 'https://'+req.get('host')) return res.sendStatus(403);
  res.set('Cache-Control','no-store');
  next();
});
function lanAddresses(){
  const addresses=Object.values(networkInterfaces()).flat()
    .filter(item=>item.family==='IPv4' && !item.internal)
    .map(item=>item.address);
  return [...new Set(addresses)];
}

app.get('/api/host-addresses',(req,res)=>{
  const addresses=lanAddresses();
  // Prefer the interface the visitor already used to reach this host.
  const hosts=addresses.includes(req.hostname) ? [req.hostname] : addresses;
  res.json({urls:hosts.map(ip=>'http://'+ip+':'+frontendPort)});
});
const clients = new Map();
installAuth(app,db,data,key=>{
  for(const [res,member] of clients)if(member.key===key)res.end();
});
function signal(event, payload){
  for(const res of clients.keys()) res.write('event: '+event+'\ndata: '+JSON.stringify(payload)+'\n\n');
}
installFileManagement(app,db,uploads,()=>signal('files-cleaned',true));
function presence(){
  const unique=new Map();
  for(const member of clients.values()) unique.set(member.device,{device:member.device,name:member.name});
  signal('members',[...unique.values()]);
}
app.get('/api/events',(req,res)=>{
  const {id,name,expires}=req.account;
  res.set({'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});
  res.flushHeaders();
  clients.set(res,{device:"account:"+id,name,key:req.sessionKey});
  presence();
  const expiry=setTimeout(()=>res.end(),Math.min(expires-Date.now(),2147483647));
  const timer=setInterval(()=>res.write(': keepalive\n\n'),20000);
  res.on('close',()=>{clearInterval(timer);clearTimeout(expiry);clients.delete(res);presence()});
});
app.get('/api/messages',(req,res)=>{
  const before=Number(req.query.before || Number.MAX_SAFE_INTEGER);
  const kind=req.query.kind || 'all';
  if(!Number.isSafeInteger(before)||!['all','image','video'].includes(kind)) return res.sendStatus(400);
  const rows=db.prepare("SELECT * FROM messages WHERE id < ? AND (? = 'all' OR mime LIKE ?) ORDER BY id DESC LIMIT 80").all(before,kind,kind+'/%');
  res.json(rows.reverse());
});
const upload=multer({dest:uploads,limits:{fields:3,files:1,fieldSize:MAX_MESSAGE_LENGTH*4}});
function mediaType(path){
  const fd=openSync(path,'r'), b=Buffer.alloc(32);
  try{readSync(fd,b,0,b.length,0)}finally{closeSync(fd)}
  const tag=b.toString('latin1');
  if(b.subarray(0,8).toString('hex')==='89504e470d0a1a0a') return 'image/png';
  if(b.subarray(0,3).toString('hex')==='ffd8ff') return 'image/jpeg';
  if(/^GIF8[79]a/.test(tag)) return 'image/gif';
  if(tag.startsWith('RIFF') && tag.slice(8,12)==='WEBP') return 'image/webp';
  if(tag.slice(4,8)==='ftyp'){
    if(['avif','avis'].includes(tag.slice(8,12))) return 'image/avif';
    if(/^(isom|iso[2-9]|mp4[12]|avc1|M4V |dash)/.test(tag.slice(8))) return 'video/mp4';
    if(tag.slice(8,12)==='qt  ') return 'video/quicktime';
  }
  if(b.readUInt32BE(0)===0x1a45dfa3) return 'video/webm';
  return null;
}
app.post('/api/messages',upload.single('media'),(req,res)=>{
  let committed=false;
  try{
    const {text=''}=req.body || {};
    const {id,name}=req.account;
    const mime=req.file ? (mediaType(req.file.path) || 'application/octet-stream') : null;
    if(typeof text!=='string')return res.status(400).json({error:'消息内容必须是文本'});
    if(text.length>MAX_MESSAGE_LENGTH)return res.status(400).json({error:MESSAGE_TOO_LONG});
    if(!text.trim()&&!req.file)return res.status(400).json({error:'请输入消息或选择附件'});
    const result=db.prepare('INSERT INTO messages(device,name,text,file,mime,filename,time,bytes) VALUES(?,?,?,?,?,?,?,?)').run("account:"+id,name,text.trim(),req.file?.filename || null,mime || null,req.file ? Buffer.from(req.file.originalname,'latin1').toString('utf8') : null,Date.now(),req.file?.size??null);
    committed=true;
    signal('message',Number(result.lastInsertRowid));
    res.status(201).json({id:Number(result.lastInsertRowid)});
  }finally{if(req.file&&!committed) unlinkSync(req.file.path)}
});
app.get('/media/:file',(req,res)=>{
  const item=db.prepare('SELECT mime,filename FROM messages WHERE file=?').get(req.params.file);
  if(!item) return res.sendStatus(404);
  res.set({'Content-Type':item.mime,'X-Content-Type-Options':'nosniff'});
  const path=join(uploads,req.params.file);
  if(item.mime==='application/octet-stream'){
    return res.download(path,item.filename || '附件');
  }
  res.sendFile(path);
});
app.use((err,req,res,next)=>{
  if(res.headersSent) return next(err);
  res.status(err instanceof multer.MulterError ? 400:500).json({error:err.code==='LIMIT_FIELD_VALUE'?MESSAGE_TOO_LONG:err.code==='ENOSPC'?'服务器磁盘空间不足':'操作失败，请重试'});
});
app.listen(backendPort,'0.0.0.0',error=>{
  if(error) throw error;
  console.log('后端 API http://localhost:'+backendPort);
});

if (!process.argv.includes('--api-only')) {
  const frontend = express();
  frontend.use(['/api','/media'], (req,res)=>{
    const upstream = request({
      hostname: '127.0.0.1',
      port: backendPort,
      method: req.method,
      path: req.originalUrl,
      headers: req.headers
    }, response=>{
      res.writeHead(response.statusCode, response.headers);
      res.flushHeaders();
      response.on('error', error=>res.destroy(error));
      response.pipe(res);
    });
    upstream.on('error', ()=>{
      if (!res.headersSent) res.sendStatus(502);
      else res.destroy();
    });
    res.on('close', ()=>upstream.destroy());
    req.pipe(upstream);
  });
  frontend.use(express.static(join(root,'frontend/dist')));
  frontend.listen(frontendPort,'0.0.0.0',error=>{
    if(error) throw error;
    console.log('聊天室 http://localhost:'+frontendPort);
    for(const ip of lanAddresses()) console.log('局域网 http://'+ip+':'+frontendPort);
  });
}
