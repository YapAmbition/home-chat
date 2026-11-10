import {DatabaseSync} from 'node:sqlite';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';

const name=process.argv[2]?.trim().normalize('NFC');
if(!name||name.length>32||process.argv.length!==3){
  console.error('用法：npm run admin -- "你的用户名"');process.exit(1);
}
const data=process.env.CHAT_DATA || fileURLToPath(new URL('./data/',import.meta.url));
const db=new DatabaseSync(resolve(data,'chat.sqlite'));
db.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');
try{
  if(!db.prepare('PRAGMA table_info(accounts)').all().some(col=>col.name==='admin')){
    throw Error('请先运行新版 npm start 初始化数据库');
  }
  if(db.prepare('SELECT id FROM accounts WHERE name=?').get(name)){
    db.prepare('UPDATE accounts SET admin=1 WHERE name=?').run(name);
    db.exec('COMMIT');
    console.log('指定账号已设为管理员。请使用原密码登录，已登录的设备刷新页面即可。');
  }else{
    const password=randomBytes(16).toString('base64url');
    const salt=randomBytes(16).toString('hex');
    const hash=scryptSync(password,salt,64).toString('hex');
    db.prepare('INSERT INTO accounts(name,salt,hash,admin) VALUES(?,?,?,1)').run(name,salt,hash);
    db.exec('COMMIT');
    console.log('已创建管理员账号。请将此密码保存到密码管理器：'+password);
  }
}catch(error){if(db.isTransaction)db.exec('ROLLBACK');console.error(error.message);process.exitCode=1}
finally{db.close()}
