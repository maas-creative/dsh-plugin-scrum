import {readFileSync,readdirSync,realpathSync} from 'node:fs';
import {join,resolve,basename,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
import {createHash} from 'node:crypto';
import {loadScrumConfiguration} from './configuration.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const segment=value=>value.replace(/[^a-zA-Z0-9_-]/g,'-')||'default';
// Matches pinned OMO storage.ts. Sources stay untouched; SQLite owns reviewed completion.
export function resolveClaudeTaskStorage({cwd=process.cwd(),env=process.env,config={}}={}){
 const tasks=config.sisyphus?.tasks||{},listId=segment(env.ULTRAWORK_TASK_LIST_ID?.trim()||env.CLAUDE_CODE_TASK_LIST_ID?.trim()||tasks.task_list_id?.trim()||basename(cwd));
 const storage=tasks.storage_path;
 return {listId,path:storage?(isAbsolute(storage)?storage:resolve(cwd,storage)):join(env.OPENCODE_CONFIG_DIR||join(env.XDG_CONFIG_HOME||join(env.HOME||homedir(),'.config'),'opencode'),'tasks',listId)};
}
function readSources(path){
 let names;try{names=readdirSync(path).filter(name=>name.endsWith('.json')&&!name.startsWith('.')).sort()}catch(error){if(error.code==='ENOENT')return [];throw error}
 return names.map(name=>{const file=join(path,name),raw=readFileSync(file,'utf8');if(Buffer.byteLength(raw)>1024*1024)throw Error('Claude task exceeds size limit: '+file);let task;try{task=JSON.parse(raw)}catch{throw Error('Invalid Claude task JSON: '+file)}
 if(!task||typeof task.id!=='string'||!task.id||typeof task.subject!=='string'||!task.subject.trim()||typeof task.description!=='string'||!['pending','in_progress','completed','deleted'].includes(task.status)||['blockedBy','blocks'].some(k=>task[k]!==undefined&&(!Array.isArray(task[k])||task[k].some(id=>typeof id!=='string'))))throw Error('Invalid Claude task record: '+file);
 return {file:realpathSync(file),raw,revision:hash(raw),task};});
}
export function importClaudeTasks(s,{cwd=process.cwd(),env=process.env,config,projectId,reconcile={}}={}){
 if(!projectId||!s.snapshot().projects.some(p=>p.id===projectId))throw Error('Explicit target project required for Claude task import');
 const storage=resolveClaudeTaskStorage({cwd,env,config:config||loadScrumConfiguration({cwd,env}).config}),records=readSources(storage.path);
 const ids=new Set();for(const {task}of records){if(ids.has(task.id))throw Error('Duplicate Claude task ID: '+task.id);ids.add(task.id)}
 const key='scrumClaudeTasks:'+hash(resolve(storage.path));
 return s.tx(()=>{
  const mapping=s.setting(key,{projectId,records:{}});if(mapping.projectId!==projectId)throw Error('Claude task list is already bound to another project');
  const changes=[];
  for(const record of records){const prior=mapping.records[record.task.id];if(prior){const canonical=s.snapshot().tasks.find(t=>t.id===prior.taskId&&t.projectId===projectId);if(!canonical)throw Error('Claude canonical task mapping is invalid');if(prior.revision===record.revision)continue;const approval=reconcile[record.task.id];if(!approval||approval.sourceRevision!==record.revision||approval.canonicalVersion!==canonical.version)throw Object.assign(Error('Claude source changed; reconcile explicitly: '+record.task.id),{status:409,sourceRevision:record.revision,canonicalVersion:canonical.version});s.task({...canonical,title:record.task.subject,nextAction:record.task.description,owner:record.task.owner||canonical.owner});mapping.records[record.task.id]={...prior,revision:record.revision,record:record.task};changes.push(record.task.id);continue}
   const taskId=s.task({projectId,title:record.task.subject,status:record.task.status==='deleted'?'cancelled':record.task.status==='completed'?'reported':record.task.status==='in_progress'?'doing':'todo',owner:record.task.owner||'Pi',nextAction:record.task.description,canonicalTarget:record.file,completionEvidence:record.task.status==='completed'?'Claude source reports completed: '+record.file:''});
   mapping.records[record.task.id]={taskId,revision:record.revision,source:record.file,record:record.task};changes.push(record.task.id);
  }
  for(const id of [...changes])for(const target of mapping.records[id].record.blocks||[]){if(changes.includes(target)||!mapping.records[target])continue;const canonical=s.snapshot().tasks.find(t=>t.id===mapping.records[target].taskId),approval=reconcile[target];if(!approval||approval.sourceRevision!==mapping.records[target].revision||approval.canonicalVersion!==canonical.version)throw Object.assign(Error('Claude dependency changes an existing canonical task; reconcile explicitly: '+target),{status:409,sourceRevision:mapping.records[target].revision,canonicalVersion:canonical.version});changes.push(target)}
  for(const id of changes){const source=mapping.records[id],task=s.snapshot().tasks.find(t=>t.id===source.taskId),external=source.record,dependencies=new Set(external.blockedBy||[]);
   for(const entry of records)if(entry.task.blocks?.includes(id))dependencies.add(entry.task.id);
   const canonical=[...dependencies].map(id=>{if(!mapping.records[id])throw Error('Missing Claude task dependency: '+id);return mapping.records[id].taskId});
   const parentId=external.parentID?mapping.records[external.parentID]?.taskId:undefined;if(external.parentID&&!parentId)throw Error('Missing Claude parent task: '+external.parentID);
   s.task({...task,dependencies:canonical,parentId});
  }
  // A writer may replace a source while imports are being validated. Reject the entire transaction.
  for(const record of records)if(hash(readFileSync(record.file,'utf8'))!==record.revision)throw Object.assign(Error('Claude source changed during import'),{status:409});
  s.set(key,mapping);return {listId:storage.listId,path:storage.path,imported:changes.length,mappings:mapping.records};
 });
}
