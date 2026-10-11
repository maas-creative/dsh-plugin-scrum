import {mkdirSync} from 'node:fs';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const alive=pid=>{try{process.kill(pid,0);return true}catch(error){if(error.code==='ESRCH')return false;throw error}};
// A transaction protects independent DSH processes sharing the browser registry.
export class BrowserState {
 constructor(directory){this.token=randomUUID();mkdirSync(directory,{recursive:true,mode:0o700});this.db=new DatabaseSync(join(directory,'ownership.sqlite'));this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,body TEXT NOT NULL)')}
 read(id){if(typeof id!=='string'||!id)throw Error('Session required');const row=this.db.prepare('SELECT body FROM sessions WHERE id=?').get(id);return row?JSON.parse(row.body):{session:id,stopped:false}}
 update(id,fn){this.db.exec('BEGIN IMMEDIATE');try{const row=this.read(id);if(row.owner&&row.owner.token!==this.token&&alive(row.owner.pid))throw Error('Browser is owned by another live process');const next=fn(row);this.db.prepare('INSERT INTO sessions(id,body) VALUES(?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body').run(id,JSON.stringify(next));this.db.exec('COMMIT');return next}catch(error){this.db.exec('ROLLBACK');throw error}}
 claim(id){return this.update(id,row=>{if(row.stopped)throw Error('Browser suspended; explicit human resume required');if(row.remoteSessionId)throw Error('Previous browser session requires cleanup');return {...row,owner:{pid:process.pid,token:this.token}}})}
 intent(id,requestId){return this.update(id,row=>({...row,requestId,owner:{pid:process.pid,token:this.token}}))}
 record(id,remoteSessionId){return this.update(id,row=>({...row,owner:{pid:process.pid,token:this.token},remoteSessionId}))}
 stop(id){return this.update(id,row=>({...row,stopped:true}))}
 resume(id){return this.update(id,row=>({...row,stopped:false}))}
 released(id){return this.update(id,row=>({...row,owner:null,remoteSessionId:null,requestId:null}))}
 close(){this.db.close()}
}
