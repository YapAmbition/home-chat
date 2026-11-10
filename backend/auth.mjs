import {randomBytes, createHash, timingSafeEqual, scrypt} from 'node:crypto';
import {promisify} from 'node:util';
import {prepareAdminSettings} from './admin-settings.mjs';
import express from 'express';
import config from '../config.json' with {type:'json'};

const derive=promisify(scrypt);
const lifetime=30*86400000;
const digest=value=>createHash('sha256').update(value).digest('hex');

export function installAuth(app,db,data,onLogout){
  db.exec(`CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE, salt TEXT NOT NULL, hash TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, account INTEGER NOT NULL REFERENCES accounts(id), expires INTEGER NOT NULL
  );`);
  prepareAdminSettings(db,data);
  // Match account names using the same collation as the accounts table.
  db.exec('CREATE TEMP TABLE configured_admins (name TEXT PRIMARY KEY COLLATE NOCASE)');
  const names=config.adminUsers===undefined ? [] : config.adminUsers;
  if(!Array.isArray(names))throw Error('config.json 的 adminUsers 必须是用户名数组');
  const addName=db.prepare('INSERT OR IGNORE INTO configured_admins VALUES(?)');
  for(const value of names){
    const name=typeof value==='string' ? value.trim().normalize('NFC') : '';
    if(!name || name.length>32)throw Error('adminUsers 中的用户名必须为 1 至 32 个字符');
    addName.run(name);
  }
  const configured=db.prepare('SELECT 1 FROM configured_admins WHERE name=?');
  function isAdmin(account){
    return Boolean(account.admin || configured.get(account.name));
  }
  const currentInvite=db.prepare('SELECT invite FROM family_settings WHERE id=1');
  const attempts=new Map();
  const clean=setInterval(()=>{
    const now=Date.now();
    for(const [ip,attempt] of attempts)if(attempt.until<=now)attempts.delete(ip);
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(now);
  },60000);
  clean.unref();
  app.use('/api/auth',express.json({limit:'3kb'}));
  function countAttempt(req,res,next){
    const ip=req.ip,now=Date.now();
    let entry=attempts.get(ip);
    if(!entry||entry.until<=now){entry={until:now+600000,count:0};attempts.set(ip,entry)}
    if(++entry.count>30)return res.status(429).json({error:'尝试过于频繁，请在十分钟后重试'});
    req.authAttempts=entry;
    next();
  }
  function credentials(register){
    return async(req,res)=>{
      const {username,password,code}=req.body||{};
      const name=typeof username==='string'?username.trim().normalize('NFC'):'';
      if(!name||name.length>32||typeof password!=='string'||password.length>128||!password.length)
        return res.status(400).json({error:'请填写有效的用户名和密码'});
      let user=db.prepare('SELECT * FROM accounts WHERE name=?').get(name);
      if(register){
        if(code!==currentInvite.get().invite)return res.status(403).json({error:'家庭邀请码不正确'});
        if(configured.get(name))return res.status(409).json({error:'此用户名已保留'});
        if(password.length<8)return res.status(400).json({error:'密码至少需要 8 个字符'});
        const salt=randomBytes(16).toString('hex');
        const hash=await derive(password,salt,64);
        const added=db.prepare('INSERT OR IGNORE INTO accounts(name,salt,hash) SELECT ?,?,? FROM family_settings WHERE id=1 AND invite=?').run(name,salt,hash.toString('hex'),code);
        if(!added.changes && code!==currentInvite.get().invite)return res.status(403).json({error:'家庭邀请码已更换'});
        if(!added.changes)return res.status(409).json({error:'这个用户名已被使用'});
        user={id:Number(added.lastInsertRowid),name};
      }else{
        const hash=await derive(password,user?.salt || 'unregistered-account',64);
        if(!user||!timingSafeEqual(hash,Buffer.from(user.hash,'hex'))||!db.prepare('SELECT 1 FROM accounts WHERE id=? AND hash=?').get(user.id,user.hash))
          return res.status(401).json({error:'用户名或密码不正确'});
      }
      const token=randomBytes(32).toString('hex');
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user.id,Date.now()+lifetime);
      res.cookie('island_session',token,{httpOnly:true,sameSite:'strict',secure:req.secure,maxAge:lifetime,path:'/'});
      req.authAttempts.count=Math.max(0,req.authAttempts.count-1);
      res.json({id:user.id,name:user.name,isAdmin:isAdmin(user)});
    }
  }
  app.post('/api/auth/register',countAttempt,credentials(true));
  app.post('/api/auth/login',countAttempt,credentials(false));
  app.use(['/api','/media'],(req,res,next)=>{
    res.set('Cache-Control','private, no-store');
    const token=/(?:^|;\s*)island_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
    const key=token&&digest(token);
    const account=key&&db.prepare('SELECT a.id,a.name,a.admin,s.expires FROM sessions s JOIN accounts a ON a.id=s.account WHERE token=? AND expires>?').get(key,Date.now());
    if(!account)return res.status(401).json({error:'请先登录'});
    account.isAdmin=isAdmin(account);
    req.account=account;
    req.sessionKey=key;
    next();
  });
  app.get('/api/auth/me',(req,res)=>res.json({id:req.account.id,name:req.account.name,isAdmin:req.account.isAdmin}));
  app.post('/api/auth/password',countAttempt,async(req,res)=>{
    const {currentPassword,newPassword}=req.body||{};
    if(typeof currentPassword!=='string'||!currentPassword.length||currentPassword.length>128||
       typeof newPassword!=='string'||newPassword.length<8||newPassword.length>128)
      return res.status(400).json({error:'请输入当前密码，新密码长度为 8 至 128 个字符'});
    const id=req.account.id;
    const account=db.prepare('SELECT salt,hash FROM accounts WHERE id=?').get(id);
    const oldHash=await derive(currentPassword,account.salt,64);
    if(!timingSafeEqual(oldHash,Buffer.from(account.hash,'hex')))
      return res.status(403).json({error:'当前密码不正确'});
    if(currentPassword===newPassword)return res.status(400).json({error:'新密码应与当前密码不同'});
    const salt=randomBytes(16).toString('hex');
    const hash=await derive(newPassword,salt,64);
    let revoked;
    db.exec('BEGIN IMMEDIATE');
    try{
      const updated=db.prepare('UPDATE accounts SET salt=?,hash=? WHERE id=? AND hash=? AND EXISTS (SELECT 1 FROM sessions WHERE token=? AND account=? AND expires>?)')
        .run(salt,hash.toString('hex'),id,account.hash,req.sessionKey,id,Date.now());
      if(!updated.changes){
        db.exec('ROLLBACK');
        return res.status(401).json({error:'请重新登录'});
      }
      revoked=db.prepare('DELETE FROM sessions WHERE account=? AND token<>? RETURNING token').all(id,req.sessionKey);
      db.exec('COMMIT');
    }catch(err){db.exec('ROLLBACK');throw err}
    for(const session of revoked)onLogout(session.token);
    req.authAttempts.count=Math.max(0,req.authAttempts.count-1);
    res.sendStatus(204);
  });
  app.use('/api/admin',(req,res,next)=>{
    if(!req.account.isAdmin)return res.status(403).json({error:'需要管理员权限'});
    next();
  },express.json({limit:'8kb'}));
  app.get('/api/admin/invite',(req,res)=>res.json(currentInvite.get()));
  app.put('/api/admin/invite',(req,res)=>{
    const {invite,previous}=req.body || {};
    if(typeof invite!=='string'||!invite.trim()||invite.trim().length>128||typeof previous!=='string')
      return res.status(400).json({error:'请输入 1 至 128 个字符的邀请码'});
    const updated=db.prepare('UPDATE family_settings SET invite=? WHERE id=1 AND invite=?').run(invite.trim(),previous);
    if(!updated.changes)return res.status(409).json({error:'邀请码已在其他页面修改，请重新读取后再保存'});
    res.json(currentInvite.get());
  });
  app.post('/api/auth/logout',(req,res)=>{
    db.prepare('DELETE FROM sessions WHERE token=?').run(req.sessionKey);
    onLogout(req.sessionKey);
    res.clearCookie('island_session',{path:'/'}).sendStatus(204);
  });
}
