// Scrum configuration migration. All configuration transformations are data-only.
import * as nativeFs from 'node:fs';
import{DatabaseSync}from'node:sqlite';
import{join,resolve,relative,isAbsolute,dirname,basename}from'node:path';
import{homedir}from'node:os';import{randomUUID,createHash}from'node:crypto';
import{parseJsonc,mergeOmoConfigRecords}from'./config-data.mjs';
import{tolerantFsyncSync}from'../fsync-tracker.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function within(root,path){const rel=relative(root,path);return rel===''||rel!=='..'&&!rel.startsWith('../')&&!isAbsolute(rel)}
function canonical(fs,path){let cursor=resolve(path),suffix=[];while(!fs.existsSync(cursor)){const parent=dirname(cursor);if(parent===cursor)break;suffix.unshift(basename(cursor));cursor=parent}return join(fs.realpathSync(cursor),...suffix)}
function boundedRead(fs,path){const stat=fs.lstatSync(path);if(!stat.isFile()||stat.isSymbolicLink())throw Error('Migration requires a regular file: '+path);const text=fs.readFileSync(path,'utf8');if(Buffer.byteLength(text)>8*1024*1024)throw Error('Migration file exceeds 8 MiB: '+path);return text}
function parseConfig(text,path){const errors=[],config=parseJsonc(text,errors);if(errors.length||!object(config))throw Error('Invalid configuration: '+path);return config}
function readConfig(fs,path){if(!fs.existsSync(path))return{};return parseConfig(boundedRead(fs,path),path)}
function atomicWrite(fs,path,text){fs.mkdirSync(dirname(path),{recursive:true,mode:0o700});const temp=path+'.'+randomUUID()+'.tmp';try{fs.writeFileSync(temp,text,{flag:'wx',mode:0o600});if(fs===nativeFs){const fd=fs.openSync(temp,'r+');try{tolerantFsyncSync(fd,'migration:'+path)}finally{fs.closeSync(fd)}}fs.renameSync(temp,path)}finally{if(fs.existsSync(temp))fs.unlinkSync(temp)}}
function normalize(config){const out=structuredClone(config);if(object(out.profiles))for(const[key,value]of Object.entries(out.profiles))if(object(value))out.profiles[key]=normalize(value);if(object(out['[senpi]'])){out['[native]']=mergeOmoConfigRecords(out['[senpi]'],out['[native]']||{});delete out['[senpi]']}return out}
function discover(fs,home,cwd,env){
 const found=[],roots=[env.OPENCODE_CONFIG_DIR||join(home,'.config','opencode'),join(home,'.config','ai.opencode.desktop'),join(home,'.config','ai.opencode.desktop.dev')];
 for(let dir=cwd;;dir=dirname(dir)){roots.push(join(dir,'.opencode'));if(dirname(dir)===dir)break}
 for(const root of [...new Set(roots)]){
  const dirs=[root],profiles=join(root,'profiles');if(fs.existsSync(profiles)&&fs.lstatSync(profiles).isDirectory())for(const name of fs.readdirSync(profiles)){const dir=join(profiles,name);if(!fs.lstatSync(dir).isSymbolicLink()&&fs.lstatSync(dir).isDirectory())dirs.push(dir)}
  for(const dir of dirs)for(const base of ['oh-my-opencode','oh-my-openagent'])for(const extension of ['.json','.jsonc']){const path=join(dir,base+extension);if(fs.existsSync(path))found.push({path,kind:'opencode-config',targetDirectory:basename(root)==='.opencode'?join(dirname(root),'.omo'):join(home,'.omo'),profile:dir===root?undefined:dir.slice(profiles.length+1)})}
 }
 const config=join(home,'.omo','config.jsonc');if(fs.existsSync(config))found.push({path:config,kind:'native-config'});
 return found;
}
function preferredTarget(fs,directory){return ['omo.jsonc','omo.json'].map(name=>join(directory,name)).find(path=>fs.existsSync(path))||join(directory,'omo.jsonc')}
function sourceLayer(source,data){return source.kind==='opencode-config'?(source.profile?{profiles:{[source.profile]:{'[opencode]':data}}}:{'[opencode]':data}):data}
function validateJournal(fs,journal,home,cwd,env){
 if(!object(journal)||![1,2].includes(journal.version)||!Array.isArray(journal.backupMoves)||!object(journal.targetWrite?.additions))throw Error('Migration journal is malformed');
 if(typeof journal.targetPath!=='string'||!isAbsolute(journal.targetPath))throw Error('Migration journal target must be an absolute path');
 if(journal.version===2){if(typeof journal.targetAfter!=='string'||journal.targetBefore!==null&&typeof journal.targetBefore!=='string'||!Array.isArray(journal.completedMoves)||journal.completedMoves.some(index=>!Number.isInteger(index)||index<0||index>=journal.backupMoves.length))throw Error('Migration journal snapshot is invalid');parseConfig(journal.targetAfter,journal.targetPath);}
 const target=canonical(fs,journal.targetPath),targetDirectories=[join(home,'.omo')];for(let dir=cwd;;dir=dirname(dir)){targetDirectories.push(join(dir,'.omo'));if(dirname(dir)===dir)break}if(!targetDirectories.filter(dir=>within(canonical(fs,dirname(dir)),canonical(fs,dir))).flatMap(dir=>['omo.jsonc','omo.json'].map(name=>canonical(fs,join(dir,name)))).includes(target))throw Error('Migration journal has an unrelated target');
 const sourceRoots=[home,cwd,...(env.OPENCODE_CONFIG_DIR?[canonical(fs,env.OPENCODE_CONFIG_DIR)]:[])];for(let dir=cwd;;dir=dirname(dir)){sourceRoots.push(canonical(fs,join(dir,'.opencode')));if(dirname(dir)===dir)break}
 for(const move of journal.backupMoves){if(!object(move)||typeof move.from!=='string'||typeof move.to!=='string'||!isAbsolute(move.from)||!isAbsolute(move.to))throw Error('Migration journal contains an invalid move');if(!sourceRoots.some(root=>within(root,canonical(fs,move.from)))||!(within(canonical(fs,join(home,'.omo')),canonical(fs,move.to))||journal.version===1&&move.to===move.from+'.backup'&&within(home,canonical(fs,move.to))))throw Error('Migration journal move is outside its workspace');if(move.stage&&(dirname(move.stage)!==dirname(move.from)||!move.stage.startsWith(move.from+'.scrum-migration-')))throw Error('Migration journal staging path is invalid')}
}
function applyJournal(fs,journal,journalPath,onBoundary){
 const writeJournal=()=>atomicWrite(fs,journalPath,JSON.stringify(journal,null,2)+'\n');
 const target=journal.targetPath,current=fs.existsSync(target)?boundedRead(fs,target):null;
 for(const move of journal.backupMoves)if(move.sha256){const candidate=move.stage&&fs.existsSync(move.stage)?move.stage:fs.existsSync(move.from)?move.from:move.to;if(!fs.existsSync(candidate)||digest(boundedRead(fs,candidate))!==move.sha256)throw Error('Migration input changed before publication: '+candidate);}
 if(journal.version===1){journal.version=2;journal.targetBefore=current;journal.targetAfter=JSON.stringify(mergeOmoConfigRecords(readConfig(fs,target),journal.targetWrite.additions),null,2)+'\n';journal.completedMoves=[];for(const move of journal.backupMoves){move.stage=move.from+'.scrum-migration-'+randomUUID()+'.stage';if(fs.existsSync(move.from))move.sha256=digest(boundedRead(fs,move.from));else if(fs.existsSync(move.to))move.sha256=digest(boundedRead(fs,move.to));else throw Error('Journal source and backup are missing')}writeJournal()}
 if(current!==journal.targetBefore&&current!==journal.targetAfter)throw Error('Migration target changed; preserving it and the journal');
 if(current!==journal.targetAfter)atomicWrite(fs,target,journal.targetAfter);
 journal.targetWritten=true;writeJournal();onBoundary?.('target-written');
 for(let index=0;index<journal.backupMoves.length;index++){
  const move=journal.backupMoves[index];
  if(journal.completedMoves.includes(index))continue;
  if(boundedRead(fs,target)!==journal.targetAfter)throw Error('Migration target changed; source move refused');
  if(!fs.existsSync(move.stage)&&fs.existsSync(move.from)){
   if(digest(boundedRead(fs,move.from))!==move.sha256)throw Error('Migration source changed: '+move.from);
   fs.renameSync(move.from,move.stage);onBoundary?.('source-staged');
  }
  if(fs.existsSync(move.stage)){
   const text=boundedRead(fs,move.stage);if(digest(text)!==move.sha256){if(!fs.existsSync(move.from))fs.renameSync(move.stage,move.from);throw Error('Migration source changed during staging; retained changed data')}
   if(fs.existsSync(move.to)){if(digest(boundedRead(fs,move.to))!==move.sha256)throw Error('Migration backup collision; retained staged source')}
   else atomicWrite(fs,move.to,text);
   if(digest(boundedRead(fs,move.to))!==move.sha256)throw Error('Migration backup verification failed');
   fs.unlinkSync(move.stage);
  }else if(!fs.existsSync(move.to)||digest(boundedRead(fs,move.to))!==move.sha256)throw Error('Migration backup is missing or modified');
  journal.completedMoves.push(index);writeJournal();onBoundary?.('backup-moved');
 }
 if(boundedRead(fs,target)!==journal.targetAfter)throw Error('Migration target changed before completion');
 fs.unlinkSync(journalPath);onBoundary?.('journal-completed');
}
export function runIndependentStartupMigration({cwd=process.cwd(),homeDir,environment,env=environment||process.env,dryRun=false,fileSystem=nativeFs,onBoundary}={}){
 const fs=fileSystem,results=[],migratedFrom=[];let journalResumed=false,db;
 try{
  const home=canonical(fs,homeDir||env.HOME||env.USERPROFILE||homedir()),workspace=canonical(fs,cwd),directory=join(home,'.omo'),journalPath=join(directory,'.migration-journal.json');
  if(!within(home,canonical(fs,directory)))throw Error('Migration storage is outside the configured home');
  if(!dryRun&&fs===nativeFs){fs.mkdirSync(directory,{recursive:true,mode:0o700});const lockPath=join(directory,'.scrum-migration-lock.sqlite');if(fs.existsSync(lockPath)&&(!fs.lstatSync(lockPath).isFile()||fs.lstatSync(lockPath).isSymbolicLink()))throw Error('Migration process lock is not a regular file');db=new DatabaseSync(lockPath);db.exec('PRAGMA busy_timeout=1000; BEGIN IMMEDIATE');}
  let journal=fs.existsSync(journalPath)?JSON.parse(boundedRead(fs,journalPath)):null;
  if(journal){validateJournal(fs,journal,home,workspace,env);journalResumed=true}
  const sources=discover(fs,home,workspace,env),targetPath=preferredTarget(fs,directory);
  const existing=normalize(readConfig(fs,targetPath));
  if(!journal&&!sources.length){const original=readConfig(fs,targetPath);if(JSON.stringify(original)===JSON.stringify(existing))return{journalResumed:false,migratedFrom,results:[{status:'skipped',diagnostics:[]}]}}
  if(dryRun){
   if(journal)results.push({status:'planned',journalResumed:true,diagnostics:[],preview:{targetPath:journal.targetPath,backupMoves:journal.backupMoves,transform:journal.targetWrite.additions}});
   const groups=new Map();for(const source of sources.filter(source=>!journal?.backupMoves.some(move=>move.from===source.path))){const dir=source.targetDirectory||directory;if(!groups.has(dir))groups.set(dir,[]);groups.get(dir).push(source)}
   for(const [dir,group]of groups){if(!within(canonical(fs,dirname(dir)),canonical(fs,dir)))throw Error('Project migration storage escapes its project');const target=preferredTarget(fs,dir);let additions={};for(const source of group)additions=mergeOmoConfigRecords(additions,sourceLayer(source,normalize(readConfig(fs,source.path))));results.push({status:'planned',diagnostics:[],preview:{targetPath:target,backupMoves:group.map(source=>({from:source.path})),transform:normalize(mergeOmoConfigRecords(additions,readConfig(fs,target)))}});}
   if(!results.length)results.push({status:'planned',diagnostics:[],preview:{targetPath,transform:existing}});
   return{journalResumed,migratedFrom,results};
  }
  fs.mkdirSync(directory,{recursive:true,mode:0o700});
  // SQLite's process lock is released on crashes. No stale-PID lock deletion race.
  // Re-read after acquiring the process lock; a competing migration may have finished.
  journal=fs.existsSync(journalPath)?JSON.parse(boundedRead(fs,journalPath)):null;
  if(journal){validateJournal(fs,journal,home,workspace,env);journalResumed=true;applyJournal(fs,journal,journalPath,onBoundary);migratedFrom.push(...journal.backupMoves.map(move=>move.from));results.push({status:'migrated',journalResumed:true,diagnostics:[]})}
  const remaining=discover(fs,home,workspace,env).filter(source=>!migratedFrom.includes(source.path)),groups=new Map([[directory,[]]]);for(const source of remaining){const dir=source.targetDirectory||directory;if(!groups.has(dir))groups.set(dir,[]);groups.get(dir).push(source)}
  for(const [scopeDirectory,scopeSources] of groups){
  if(!within(canonical(fs,dirname(scopeDirectory)),canonical(fs,scopeDirectory)))throw Error('Project migration storage escapes its project');
  const currentPath=preferredTarget(fs,scopeDirectory),current=readConfig(fs,currentPath);let additions={};const moves=[];
  const stamp=new Date().toISOString().replaceAll(':','-').replaceAll('.','-');
  for(const source of scopeSources){const sourceText=boundedRead(fs,source.path),data=normalize(parseConfig(sourceText,source.path));const layer=sourceLayer(source,data);additions=mergeOmoConfigRecords(additions,layer);const relativeSource=within(home,source.path)?relative(home,source.path):join('project',digest(dirname(source.path)).slice(0,12),source.path.split('/').at(-1));moves.push({from:source.path,to:join(directory,'migration-backup-'+stamp+'-'+source.kind,relativeSource),stage:source.path+'.scrum-migration-'+randomUUID()+'.stage',sha256:digest(sourceText)})}
  const next=normalize(mergeOmoConfigRecords(additions,current));
  if(moves.length||JSON.stringify(current)!==JSON.stringify(next)){
   const nextJournal={version:2,migrationId:randomUUID(),targetPath:currentPath,targetWrite:{additions:next},targetBefore:fs.existsSync(currentPath)?boundedRead(fs,currentPath):null,targetAfter:JSON.stringify(next,null,2)+'\n',targetWritten:false,completedMoves:[],backupMoves:moves,diagnostics:[]};
   validateJournal(fs,nextJournal,home,workspace,env);atomicWrite(fs,journalPath,JSON.stringify(nextJournal,null,2)+'\n');onBoundary?.('journal-written');applyJournal(fs,nextJournal,journalPath,onBoundary);migratedFrom.push(...moves.map(move=>move.from));results.push({status:'migrated',diagnostics:[],preview:{targetPath:currentPath,backupMoves:moves.map(({from,to})=>({from,to})),transform:next}});
  }
  }
  if(!results.length)results.push({status:'skipped',diagnostics:[]});return{journalResumed,migratedFrom,results};
 }catch(error){return{error:error.message,journalResumed,migratedFrom,results}}
 finally{if(db){try{db.exec('ROLLBACK')}catch{}db.close()}}
}
