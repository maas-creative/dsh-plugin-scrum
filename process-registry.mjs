import {mkdirSync,readdirSync,readFileSync,writeFileSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const alive=pid=>{try{process.kill(pid,0);return true}catch(error){if(error.code==='ESRCH')return false;throw error}};
// A PID alone is never ownership evidence: require our unguessable spawn marker
// and the original process group before signalling any recovered process.
export function processIdentity(pid,token,expectedGroup=pid){
 if(!Number.isSafeInteger(pid)||pid<1||!/^[-a-z0-9]+$/i.test(token))return false;
 const result=spawnSync('ps',['eww','-p',String(pid),'-o','pgid=,command='],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.status!==0)return false;
 const output=result.stdout.trim(),group=Number(output.match(/^\d+/)?.[0]);
 return group===expectedGroup&&new RegExp('(?:^|\\s)SCRUM_MONITOR_ID='+token+'(?:\\s|$)').test(output);
}
function groupMembers(group){
 const result=spawnSync('ps',['-axo','pid=,pgid='],{encoding:'utf8',maxBuffer:4*1024*1024});
 if(result.status!==0)throw Error('Cannot inspect owned process group');
 return result.stdout.trim().split('\n').map(line=>line.trim().split(/\s+/).map(Number)).filter(([,pgid])=>pgid===group).map(([pid])=>pid);
}
export function stopOwnedGroup(pid,token){
 const members=process.platform==='win32'?(alive(pid)?[pid]:[]):groupMembers(pid);
 if(!members.length)return 'already-exited';
 if(process.platform==='win32'||!members.every(member=>processIdentity(member,token,pid)))return 'identity-unconfirmed';
 try{process.kill(-pid,'SIGKILL')}catch(error){if(error.code!=='ESRCH')throw error}
 return 'recovered-stopped';
}
export class ProcessRegistry{
 constructor(directory){this.directory=directory;mkdirSync(directory,{recursive:true,mode:0o700})}
 file(id){if(!/^[a-z0-9-]+$/i.test(id))throw Error('Invalid monitor identity');return join(this.directory,id+'.json')}
 save(record){const file=this.file(record.id),temporary=file+'.'+process.pid+'.tmp';writeFileSync(temporary,JSON.stringify(record),{mode:0o600});renameSync(temporary,file)}
 remove(id){try{unlinkSync(this.file(id))}catch(error){if(error.code!=='ENOENT')throw error}}
 complete(id){const record=JSON.parse(readFileSync(this.file(id),'utf8')),status=stopOwnedGroup(record.pid,record.token);if(status!=='identity-unconfirmed')this.remove(id);return status}
 recover(){const results=[];for(const name of readdirSync(this.directory).filter(name=>name.endsWith('.json'))){
  let record;try{record=JSON.parse(readFileSync(join(this.directory,name),'utf8'));if(record.id+'.json'!==name||!Number.isSafeInteger(record.pid)||record.pid<1||!Number.isSafeInteger(record.hostPid)||record.hostPid<1||typeof record.token!=='string'||!/^[a-z0-9-]+$/i.test(record.token))throw Error('Invalid registry record')}catch{results.push({id:name.slice(0,-5),status:'invalid-record'});continue}
  if(record.hostPid===process.pid||alive(record.hostPid))continue;
  const status=stopOwnedGroup(record.pid,record.token);if(status!=='identity-unconfirmed')this.remove(record.id);results.push({id:record.id,status});
 }return results}
}
