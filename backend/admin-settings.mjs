import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

export function prepareAdminSettings(db,data){
  db.exec('BEGIN IMMEDIATE');
  try{
    if(!db.prepare('PRAGMA table_info(accounts)').all().some(column=>column.name==='admin')){
      db.exec('ALTER TABLE accounts ADD COLUMN admin INTEGER NOT NULL DEFAULT 0');
    }
    db.exec('CREATE TABLE IF NOT EXISTS family_settings (id INTEGER PRIMARY KEY CHECK(id=1), invite TEXT NOT NULL)');
    if(!db.prepare('SELECT id FROM family_settings WHERE id=1').get()){
      let invite;
      try{invite=readFileSync(join(data,'family-invite.txt'),'utf8').trim()}
      catch(error){if(error.code!=='ENOENT')throw error}
      db.prepare('INSERT INTO family_settings VALUES(1,?)').run(invite || randomBytes(12).toString('base64url'));
    }
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error}
}
