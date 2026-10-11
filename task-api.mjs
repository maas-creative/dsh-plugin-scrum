import {taskInputAliases} from './task-input.mjs';
import {backgroundCancel} from './background-cancel.mjs';
import {importClaudeTasks} from './claude-tasks.mjs';
import {ThreadStore} from './thread.mjs';
import {randomUUID} from 'node:crypto';
import {readExecutionState,executionStopped} from './controller.mjs';
import {routeTask} from './categories.mjs';
export const taskMethods=['task','background_cancel','task_list','task_get','task_create','task_update','team_send','team_messages','handoff','dag','events','monitor_start','monitor_stop','monitor_list','monitor_output'];
export async function taskApi(runtime,method,args,parent,caller){
 const s=runtime.s,owned=runtime.list().filter(a=>a.parentSession===parent);
 const state=readExecutionState(s,parent),scope=new Set(state.projectIds||[]);
 for(let changed=true;changed;){changed=false;for(const p of s.snapshot().projects)if(scope.has(p.parentProjectId)&&!scope.has(p.id)){scope.add(p.id);changed=true}}
 if(['task_list','task_get'].includes(method)&&args.import_claude===true){const projectId=args.projectId;if(!projectId||scope.size&&!scope.has(projectId))throw Error('Explicit authorized project required for Claude import');const project=s.snapshot().projects.find(p=>p.id===projectId);if(!project?.cwd)throw Error('Claude import project requires a workspace');if(runtime.list().some(a=>a.parentSession===parent&&s.snapshot().tasks.some(t=>t.id===a.taskId&&t.projectId===projectId)&&['running','preparing','retrying','uncertain'].includes(a.status)))throw Error('Stop running assignments before Claude reconciliation');importClaudeTasks(s,{cwd:project.cwd,projectId,reconcile:args.reconcile_claude||{}});}
 const task=id=>{const t=s.snapshot().tasks.find(t=>t.id===id);if(!t||(s.executionOnly?t.parentSession!==parent:scope.size&&!scope.has(t.projectId)))throw Error('この計画のタスクではありません');return t};
 if(method==='task_list')return s.snapshot().tasks.filter(t=>(s.executionOnly?t.parentSession===parent:!scope.size||scope.has(t.projectId))&&(args.all===true||!['done','cancelled'].includes(t.status)));
 if(method==='task_get')return task(args.id);
 if(method==='task'){
  if(executionStopped(state))throw Error('停止・完了した計画には委譲しません');
  task(args.taskId);
  if(args.session_id){const a=owned.find(a=>a.runId===args.session_id&&!['cancelled','done'].includes(a.status));if(!a||a.taskId!==args.taskId)throw Error('この担当セッションを再利用できません');}
  const pick=routeTask({...args,action:args.prompt||args.action,reason:args.reason||'親からの委譲',dispatch:true},s.setting('scrumCategories',{}));
  if(typeof pick.action!=='string'||!pick.action.trim()||pick.action.length>20000)throw Error('担当への作業指示が必要です');
  if(args.run_in_background===false)return runtime.foreground(pick,parent,{timeoutMs:args.timeout_ms});
  const key='scrumQueue:'+parent,queue=s.setting(key,[]);if(queue.some(p=>p.taskId===pick.taskId))return {queued:true,taskId:pick.taskId};
  s.set(key,[...queue,pick]);runtime.schedule();return {queued:true,taskId:pick.taskId,parentSession:parent};
 }
 if(method==='background_cancel')return backgroundCancel(runtime,args,parent);
 if(method==='task_create'||method==='task_update'){
  // A running authorized parent plans through these tools. Protect task versions
  // and worker ownership below rather than rejecting the parent's own turn.
  const old=method==='task_update'?task(args.id):null;
  const expected=args.expected_version??args.version;
 if(old&&expected===undefined)throw Error('task_update requires version or expected_version');if(old&&expected!==undefined&&(!Number.isInteger(expected)||expected!==old.version))throw Object.assign(new Error('タスクの版が変更されました。再読込してください'),{status:409});
  if(args.status==='done')throw Error('成果物確認はreview操作で実施してください');
  if(old&&runtime.list().some(a=>a.taskId===old.id&&['running','preparing','uncertain'].includes(a.status)))throw Error('担当が実行中です');
  const projectId=args.projectId||old?.projectId;if(scope.size&&!scope.has(projectId))throw Error('対象外のプロジェクトです');
  const normalized=taskInputAliases(args,old);
 for(const id of [...normalized.dependencies,...normalized.downstream])task(id);
 if(args.parentId)task(args.parentId);
 return s.tx(()=>{
 const result=s.task({...old,...normalized,...(s.executionOnly?{parentSession:parent,cwd:args.cwd||old?.cwd||runtime.parentCwd?.(parent)}:{}),projectId,status:args.status||old?.status||'todo',title:args.title||args.subject||old?.title,owner:args.owner||old?.owner||'Pi'});
 for(const id of normalized.downstream){const target=task(id);if(runtime.list().some(a=>a.taskId===id&&['running','preparing','uncertain'].includes(a.status)))throw Error('担当が実行中です');s.task({...target,dependencies:[...new Set([...target.dependencies,result])]})}
 if(s.executionOnly&&method==='task_create')runtime.events.append(parent,'execution.created',{taskId:result,to:'todo'});return s.snapshot().tasks.find(t=>t.id===result)||result;
 });
 }
 if(method==='events')return runtime.events.history(parent,args.after||0);
 const monitors=()=>s.all("SELECT value FROM settings WHERE key LIKE 'scrumMonitor:%'").map(r=>JSON.parse(r.value)).filter(m=>m.parentSession===parent);
 if(method==='monitor_start'){task(args.taskId);const m={id:randomUUID(),taskId:args.taskId,parentSession:parent,active:true,created:Date.now()};s.set('scrumMonitor:'+m.id,m);runtime.schedule();return m;}
 if(method==='monitor_list')return monitors();
 if(method==='monitor_output'||method==='monitor_stop'){const m=monitors().find(m=>m.id===args.id);if(!m)throw Error('この親の監視ではありません');if(method==='monitor_stop'){m.active=false;s.set('scrumMonitor:'+m.id,m)}return m;}
 const mailboxKey='scrumMailbox:'+(caller||parent);
 if(method==='team_messages'){
  return s.tx(()=>{const messages=s.setting(mailboxKey,[]);if(args.ack_ids!==undefined){
   if(!Array.isArray(args.ack_ids)||!args.ack_ids.length||args.ack_ids.some(id=>typeof id!=='string'||!messages.some(m=>m.id===id)))throw Error('Specific IDs from this session mailbox are required');
   s.set(mailboxKey,messages.map(m=>args.ack_ids.includes(m.id)?{...m,read:true,acknowledgedAt:Date.now()}:m));
  }return s.setting(mailboxKey,[]).filter(m=>args.unread!==true||!m.read)});
 }
 if(method==='team_send'){
  const destination=args.to||parent;
  if(destination!==parent&&!owned.some(a=>a.runId===destination)&&!(runtime.threads||new ThreadStore(s,runtime.threadAdapter||{})).list(parent).some(t=>t.sessionId===destination))throw Error('この親のチームではありません');
  if(typeof args.message!=='string'||!args.message.trim()||args.message.length>20000)throw Error('メッセージを確認してください');
  const key='scrumMailbox:'+destination;
  const m=s.tx(()=>{const messages=s.setting(key,[]),from=caller||parent;
   if(args.idempotency_key!==undefined&&(typeof args.idempotency_key!=='string'||!args.idempotency_key.trim()||args.idempotency_key.length>200))throw Error('Invalid message idempotency key');
   const prior=args.idempotency_key&&messages.find(m=>m.from===from&&m.idempotencyKey===args.idempotency_key);
   if(prior){if(prior.message!==args.message)throw Error('Message idempotency key conflict');return prior}
   const message={id:randomUUID(),from,to:destination,message:args.message,created:Date.now(),read:false,...(args.idempotency_key?{idempotencyKey:args.idempotency_key}:{})};s.set(key,[...messages,message]);return message;
  });
  if(destination===parent)s.set('scrumContinue:'+parent,true);runtime.schedule();
  return {queued:true,id:m.id};
 }
 if(method==='handoff')return {schemaVersion:1,parentSession:parent,goal:state,projects:s.snapshot().projects.filter(p=>!scope.size||scope.has(p.id)),tasks:s.snapshot().tasks.filter(t=>!scope.size||scope.has(t.projectId)),assignments:owned,notifications:runtime.reports.all().filter(r=>r.parentSession===parent),messages:s.setting(mailboxKey,[])};
 if(method==='dag'){
  const tasks=s.snapshot().tasks.filter(t=>!scope.size||scope.has(t.projectId));return {schemaVersion:1,status:state.phase,nodes:tasks.map(t=>({id:t.id,label:t.title,state:t.status,depends_on:t.dependencies,assignment:owned.find(a=>a.taskId===t.id)})),edges:tasks.flatMap(t=>t.dependencies.map(id=>({from:id,to:t.id})))};
 }
 throw Error('未対応の操作です');
}
