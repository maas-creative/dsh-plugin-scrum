import {recoverWorkpoolWorkers} from './workpool-recovery.mjs';
import {randomBytes} from 'node:crypto';
import {mkdirSync,appendFileSync} from 'node:fs';
import {join} from 'node:path';
import {createWorkpoolEngine,createWorkpoolStore,WorkpoolCommandSchema,appendAssignedMessages,beginWorkerTurn,acknowledgeWorkerTurn} from './independent/workpool.mjs';
import {ThreadStore} from './thread.mjs';
import {executionStopped,readExecutionState} from './controller.mjs';
export const readWorkpools=dir=>dir?createWorkpoolStore(join(dir,'workpool')).list():[];
// Scrum owns keyed queues, worker generations and aggregate receipts.
// The host adapter binds admissions to native parent-owned threads.
export function createWorkpoolRuntime(runtime,{deliver,waitForIdle}={}){
 const hostInstance=randomBytes(16).toString('hex');
 const stateDir=join(runtime.dir,'workpool'),store=runtime.s,threads=()=>runtime.threads||new ThreadStore(store,runtime.threadAdapter||{});
 mkdirSync(join(stateDir,'logs'),{recursive:true,mode:0o700});
 const tasks={stateDir,list:()=>store.all("SELECT value FROM settings WHERE key LIKE 'scrumPoolWorker:%'").map(r=>JSON.parse(r.value)),load:id=>store.setting('scrumPoolWorker:'+id,null),mutate:(id,fn)=>store.tx(()=>{const old=tasks.load(id);if(!old)return null;const next=fn(old);store.set('scrumPoolWorker:'+id,next);return next}),appendEvent:(id,event)=>{appendFileSync(join(stateDir,'logs',id+'.jsonl'),JSON.stringify(event)+'\n',{mode:0o600});return id}};
 const pools=createWorkpoolStore(stateDir),pending=new Set(),work=new Set();let closed=false;
 const recovery=recoverWorkpoolWorkers({...runtime,threads:threads()},pools,tasks);
 const save=record=>store.set('scrumPoolWorker:'+record.task_id,record);
 const resolve=(caller,agent)=>{if(agent.model&&agent.model!=='gpt-6.1-sol')throw Error('Scrum requires GPT 6.1 Sol low');return {plan:{model:'gpt-6.1-sol',agentType:agent.subagent_type,category:agent.category,resolved_model:{provider:'openai-codex',model_id:'gpt-6.1-sol',display:'GPT 6.1 Sol',source:'explicit',reasoning_effort:'low'}},start:{prompt:agent.prompt,parent_session_id:caller.sessionId,root_session_id:caller.rootSessionId,depth:caller.depth+1,cwd:caller.cwd,execution_mode:'in-process',...(agent.subagent_type?{subagent_type:agent.subagent_type}:{category:agent.category})}}};
 const admission={tasks,resolve,supportsToolRestrictions:runtime.threadAdapter?.supportsToolRestrictions===true,hasFreeSlot:()=>pending.size===0,get:id=>tasks.load(id)||undefined,pending:id=>pending.has(id),drain(){},
  cancel:async id=>{const record=tasks.load(id);if(!record||record.cleanupComplete)return;save({...record,killed:true,status:'cancelled'});try{if(record.thread_id)await threads().handle({method:'thread_interrupt',args:{thread:record.thread_id,discardInbox:true},parentSession:record.parent_session_id});tasks.mutate(id,r=>({...r,cleanupComplete:true,cleanupError:null}))}catch(error){tasks.mutate(id,r=>({...r,cleanupError:error.message}));return {error:error.message}}},
  waitFor:async(id,signal)=>{const record=tasks.load(id);if(!record)return null;if(!waitForIdle)throw Error('Workpool native idle observer unavailable');await waitForIdle(record.child_session_id,signal);signal.throwIfAborted();return tasks.mutate(id,r=>({...r,status:r.killed?'cancelled':'completed'}))},
  request:request=>{let cancelled=false,workerId,runEpoch;const job=Promise.resolve().then(async()=>{
   if(cancelled||closed||!request.current())return;request.authorize();if(executionStopped(readExecutionState(store,request.pool.parent_session_id)))throw Error('Stopped parent cannot start pool work');
   const id=request.worker?.task_id||'st_'+randomBytes(4).toString('hex'),epoch=request.worker?request.worker.run_epoch+1:0;pending.add(id);workerId=id;runEpoch=epoch;
   let record=tasks.load(id);
   if(!record){save({task_id:id,parent_session_id:request.pool.parent_session_id,pool_id:request.pool.pool_id,pool_generation:request.pool.generation,host_pid:process.pid,host_instance:hostInstance,status:'pending',notification:{run_epoch:epoch}});const thread=await threads().handle({method:'thread_create',parentSession:request.pool.parent_session_id,args:{name:request.pool.name+' '+id,cwd:request.pool.worker_spec.start.cwd,...(runtime.workpoolProject?.(request.pool.parent_session_id)?{projectId:runtime.workpoolProject(request.pool.parent_session_id)}:{}),subagent_type:request.pool.agent.subagent_type,category:request.pool.agent.category,...(request.pool.tools?{tools:request.pool.tools}:{}),idempotency_key:'pool-worker:'+id}});record={...tasks.load(id),thread_id:thread.id,child_session_id:thread.sessionId};save(record);}
   if(cancelled||closed||!request.current()||executionStopped(readExecutionState(store,request.pool.parent_session_id))){await admission.cancel(id);return;}
   if(record.hostCrashed)throw Error('Retired native pool worker cannot be revived');
   record={...record,pool_id:request.pool.pool_id,pool_generation:request.pool.generation,host_pid:process.pid,host_instance:hostInstance,status:'running',notification:{run_epoch:epoch}};save(record);
   if(!request.bind(id,epoch)){await admission.cancel(id);return;}
   const turn={pool_id:request.pool.pool_id,generation:request.pool.generation,task_id:id,run_epoch:epoch};
   appendAssignedMessages({pools,tasks},turn);const captured=beginWorkerTurn({pools,tasks},turn);if(!captured)throw Error('Workpool assignment unavailable');
   await threads().handle({method:'thread_send',parentSession:record.parent_session_id,args:{thread:record.thread_id,message:request.pool.agent.prompt+'\n\n'+captured.message,idempotency_key:'pool-turn:'+id+':'+epoch}});
   acknowledgeWorkerTurn({pools,tasks},turn,captured.entries);request.event({kind:'dispatched',pool_id:request.pool.pool_id,task_id:id,run_epoch:epoch});
  }).catch(error=>{if(workerId)tasks.mutate(workerId,r=>({...r,status:'error',error:error.message}));request.event({kind:'admission_failed',pool_id:request.pool.pool_id,item_id:request.item.item_id,...(workerId?{task_id:workerId,run_epoch:runEpoch}:{}),error:{code:'delivery_uncertain',message:error.message}})}).finally(()=>{if(workerId)pending.delete(workerId);work.delete(job)});
  work.add(job);return {cancel:()=>{cancelled=true}};
 }};
 const engine=createWorkpoolEngine(stateDir,admission);engine.setSpawnPolicy(pool=>!closed&&!executionStopped(readExecutionState(store,pool.parent_session_id)));
 engine.bindAggregate({enqueue:(message,receipts)=>{const parent=pools.load(message.pool_id).parent_session_id;const job=Promise.resolve().then(async()=>{if(!deliver)throw Error('Workpool aggregate delivery unavailable');await deliver(parent,message);receipts.ack()}).catch(receipts.fail).finally(()=>work.delete(job));work.add(job)}});
 return {engine,tasks,pools,recovery,
  async handle({args={},parentSession,callerSession}){
   const input=WorkpoolCommandSchema.parse(args),caller=callerSession||parentSession;
   const worker=store.all("SELECT value FROM settings WHERE key LIKE 'scrumPoolWorker:%'").map(r=>JSON.parse(r.value)).find(r=>r.child_session_id===caller);
   if(input.op==='yield'){if(worker?.hostCrashed||worker?.hostReleased)throw Error('Retired native pool worker may not yield');if(!worker)throw Error('Only assigned worker may yield');return engine.yieldResults(worker.task_id,worker.notification.run_epoch,input)}
   if(worker||caller!==parentSession)throw Error('Only parent may manage workpool');
   if(executionStopped(readExecutionState(store,parentSession))&&['create','push'].includes(input.op))throw Error('Stopped parent cannot start pool work');
   const identity={sessionId:parentSession,rootSessionId:parentSession,depth:0,cwd:runtime.threadCwd?.(parentSession)||runtime.dir};
   if(!executionStopped(readExecutionState(store,parentSession)))engine.attach(identity);
   if(input.op==='create'){const {op,...value}=input;return engine.create(identity,value)}
   if(input.op==='push')return engine.push(identity,input.pool_id,input.items);
   return engine[input.op](identity,input.pool_id);
  },
  async stop(parent){const owned=pools.list().filter(p=>p.parent_session_id===parent);for(const p of owned)if(p.status!=='cancelled'&&!(p.status==='closing'&&p.aggregate?.delivered&&p.items.every(i=>['completed','error','cancelled'].includes(i.status))))engine.cancel({sessionId:parent,rootSessionId:parent,depth:0,cwd:runtime.dir},p.pool_id,{suppressNotification:true});await Promise.allSettled([...work]);const results=await Promise.all(owned.flatMap(p=>p.workers.map(w=>admission.cancel(w.task_id))));const errors=results.filter(r=>r?.error);if(errors.length)throw Error(errors.map(r=>r.error).join('; '));for(const p of owned)pools.mutate(p.pool_id,current=>({...current,workers:current.workers.map(w=>tasks.load(w.task_id)?.cleanupComplete?{...w,status:'idle'}:w)}));},
  async close(){closed=true;engine.dispose();await Promise.allSettled([...work]);for(const record of tasks.list().filter(r=>r.host_instance===hostInstance&&['pending','running'].includes(r.status))){const result=await admission.cancel(record.task_id);if(!result?.error)tasks.mutate(record.task_id,r=>({...r,hostReleased:true}))}}
 };
}
