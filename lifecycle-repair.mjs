import {readFile,writeFile,lstat,open,rename,unlink} from 'node:fs/promises';
import {dirname,basename,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {sessionFormatCatalog} from '@deepseek-ai/dsh-session-format-catalog';
import {validateStoredEvents} from '@deepseek-ai/dsh-session-persistence';
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
export function validateLifecycleLog(rows){
 const restore=sessionFormatCatalog.createRestore(rows[0],{recovery:'strict',validation:'current'});
 for(const row of rows.slice(1))restore.decodeRow(row);
 const artifact=restore.finish();validateStoredEvents(artifact.header,artifact.events);return artifact;
}
export function planLifecycleRepair(text){
 if(!text.endsWith('\n'))throw Error('Refuse unterminated log; repair torn tail separately');
 const lines=text.slice(0,-1).split('\n'),rows=lines.map(line=>JSON.parse(line)),header=rows[0];
 if(header?.type!=='session'||header.version!==4||header.isSeeded!==false)throw Error('Only unseeded plain JSONL v4 sessions are supported');
 const firstSystem=rows.findIndex(row=>row.type==='system/message'),changes=[];
 for(let i=1;i<rows.length&&(firstSystem<0||i<firstSystem);i++){
  const row=rows[i],source=row.data?.source,content=row.data?.content;
  if(row.type!=='user/message'||row.surfaceOp!=='append'||source?.kind!=='runtime-context'||source.provider!=='scrum-lifecycle'||!Array.isArray(content)||content.length!==1||content[0]?.type!=='text'||!/^\[Scrum (startup|init-deep advisor)\] /.test(content[0].text))continue;
  // Keep the original event, seq and message unchanged inside the log-only record.
  rows[i]={type:'scrum/lifecycle-notice-recovered',ignorable:true,seq:row.seq,time:row.time,data:{originalEvent:row}};
  lines[i]=JSON.stringify(rows[i]);changes.push({seq:row.seq,notice:content[0].text.startsWith('[Scrum startup]')?'startup':'advisor'});
 }
 validateLifecycleLog(rows);
 return {id:header.id,changes,text:lines.join('\n')+'\n'};
}
async function durableWrite(path,bytes,mode){const file=await open(path,'wx',mode);try{await file.writeFile(bytes);await file.sync()}finally{await file.close()}}
// Run only while the host is stopped. Explicit files prevent accidentally repairing unrelated sessions.
export async function repairLifecycleFile(path,{apply=false,expectedSha256}={}){
 const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw Error('Refuse nonregular, symlink or multiply linked log');
 const original=await readFile(path),sha256=digest(original);if(expectedSha256&&expectedSha256!==sha256)throw Error('Source hash changed');
 const plan=planLifecycleRepair(original.toString('utf8')),result={path,id:plan.id,changes:plan.changes,sha256,validated:true,applied:false};
 if(!apply||!plan.changes.length)return result;
 const backup=path+'.scrum-lifecycle-original-'+randomUUID()+'.bak',temporary=join(dirname(path),'.'+basename(path)+'.repair-'+randomUUID()+'.tmp');
 try{
  await durableWrite(backup,original,stat.mode&0o777);
  if(digest(await readFile(backup))!==sha256)throw Error('Backup verification failed');
  await durableWrite(temporary,Buffer.from(plan.text),stat.mode&0o777);
  validateLifecycleLog((await readFile(temporary,'utf8')).trimEnd().split('\n').map(line=>JSON.parse(line)));
  const current=await lstat(path);if(current.dev!==stat.dev||current.ino!==stat.ino||digest(await readFile(path))!==sha256)throw Error('Source changed before replacement');
  await rename(temporary,path);const directory=await open(dirname(path),'r');try{await directory.sync()}finally{await directory.close()}
  return {...result,applied:true,backup,repairedSha256:digest(Buffer.from(plan.text))};
 }finally{await unlink(temporary).catch(()=>{})}
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 const args=process.argv.slice(2),apply=args.includes('--apply'),files=args.filter(arg=>arg!=='--apply'&&arg!=='--dry-run');
 if(!files.length)throw Error('Usage: node lifecycle-repair.mjs [--dry-run|--apply] FILE... (stop host first)');
 for(const path of files){try{console.log(JSON.stringify(await repairLifecycleFile(path,{apply})))}catch(error){console.log(JSON.stringify({path,applied:false,error:error.message}));process.exitCode=1}}
}
