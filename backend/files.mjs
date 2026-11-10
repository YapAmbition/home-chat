import {join} from 'node:path';
import {statSync,unlinkSync} from 'node:fs';

const dayMs=86400000;
function midnight(value){
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return NaN;
  const utc=Date.parse(value+'T00:00:00Z');
  if(!Number.isFinite(utc)||new Date(utc).toISOString().slice(0,10)!==value)return NaN;
  return utc-8*3600000;
}

export function installFileManagement(app,db,uploads,notify){
  db.exec('CREATE TABLE IF NOT EXISTS pending_file_removals (file TEXT PRIMARY KEY)');
  if(!db.prepare('PRAGMA table_info(messages)').all().some(column=>column.name==='bytes')){
    db.exec('BEGIN IMMEDIATE');
    try{
      db.exec('ALTER TABLE messages ADD COLUMN bytes INTEGER');
      const update=db.prepare('UPDATE messages SET bytes=? WHERE id=?');
      for(const item of db.prepare('SELECT id,file FROM messages WHERE file IS NOT NULL').all()){
        const stat=statSync(join(uploads,item.file),{throwIfNoEntry:false});
        update.run(stat?.size??0,item.id);
      }
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error}
  }
  const condition='file IS NOT NULL AND time>=? AND time<?';
  const summary=db.prepare('SELECT count(*) AS count, coalesce(sum(bytes),0) AS bytes, max(id) AS latest FROM messages WHERE '+condition);
  const listing=db.prepare('SELECT id,name,time,file,filename,mime,bytes FROM messages WHERE '+condition+' ORDER BY time DESC,id DESC LIMIT 30 OFFSET ?');
  function range(req,res,next){
    const values=req.method==='GET'?req.query:req.body || {};
    const {from,to}=values;
    if(req.method==='GET' && from===undefined && to===undefined){
      req.dates=[-8640000000000000,8640000000000000];
    }else{
      const start=midnight(from),last=midnight(to);
      if(!Number.isFinite(start)||!Number.isFinite(last)||start>last)
        return res.status(400).json({error:'请选择有效的起止日期'});
      req.dates=[start,last+dayMs];
    }
    next();
  }
  function drain(){
    const done=db.prepare('DELETE FROM pending_file_removals WHERE file=?');
    let pending=0;
    for(const {file} of db.prepare('SELECT file FROM pending_file_removals').all()){
      try{unlinkSync(join(uploads,file))}
      catch(error){if(error.code!=='ENOENT'){pending++;continue}}
      done.run(file);
    }
    return pending;
  }
  drain();
  setInterval(drain,60000).unref();
  function snapshot(dates,stats){return [...dates,stats.latest,stats.count].join('/')}
  app.get('/api/admin/files',range,(req,res)=>{
    const page=Number(req.query.page??1);
    if(!Number.isSafeInteger(page)||page<1||page>100000000)return res.status(400).json({error:'无效页码'});
    const stats=summary.get(...req.dates);
    res.json({...stats,snapshot:snapshot(req.dates,stats),files:listing.all(...req.dates,(page-1)*30)});
  });
  app.post('/api/admin/files/clean',range,(req,res)=>{
    db.exec('BEGIN IMMEDIATE');
    let stats;
    try{
      stats=summary.get(...req.dates);
      if(req.body.snapshot!==snapshot(req.dates,stats)){
        db.exec('ROLLBACK');
        return res.status(409).json({error:'附件列表已变化，请刷新后重新确认'});
      }
      db.prepare('INSERT OR IGNORE INTO pending_file_removals SELECT file FROM messages WHERE '+condition).run(...req.dates);
      db.prepare("UPDATE messages SET text=CASE WHEN text='' THEN '附件已清理' ELSE text END,file=NULL,mime=NULL,filename=NULL,bytes=NULL WHERE "+condition).run(...req.dates);
      db.exec('COMMIT');
    }catch(error){db.exec('ROLLBACK');throw error}
    notify();
    res.json({count:stats.count,pending:drain()});
  });
}
