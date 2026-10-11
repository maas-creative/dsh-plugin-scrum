import {recordDagHost,pauseCrashedDagRuns} from './dag-crash-recovery.mjs';
import {join} from 'node:path';
import {createDagFileStore,createDagManager,createDagScheduler,createDagRecovery,observeDagSchedulers} from './independent/dag-engine.mjs';
import {createDagTaskAdapter} from './dag-task-adapter.mjs';
import {executionStopped} from './controller.mjs';
export function createNativeDagRuntime(runtime){
 const store=createDagFileStore({project_dir:runtime.dir,task:{state_dir:join(runtime.dir,'native-dag')}}),manager=createDagManager({store}),tasks=createDagTaskAdapter(runtime),controllers=new Map(),work=new Map();let closed=false;
 const recoveryWork=new Map();
 const unobserve=observeDagSchedulers(tasks,scheduler=>{controllers.set(scheduler.snapshot().runId,scheduler);if(closed)void scheduler.suspend()});
 const recovery=createDagRecovery({store,taskManager:tasks,isRunHeldInProcess:id=>work.has(id)||Boolean(controllers.get(id)&&recoveryWork.has(controllers.get(id).snapshot().parentSessionId)),stopAdmission:id=>{void controllers.get(id)?.suspend()}});
 const drive=(id,parent)=>{if(work.has(id))return;const record=manager.record(id,parent);if(['completed','failed','cancelled'].includes(record.status))return;for(const node of record.nodes)if(['running','scheduled'].includes(node.state)&&node.taskId&&['running','pending'].includes(tasks.get(node.taskId)?.status)&&!tasks.getResidentHandle(node.taskId))throw Error('DAG child has no live host; recover owned run before attaching');const attached=new Map(record.nodes.filter(node=>['running','scheduled'].includes(node.state)&&node.taskId&&tasks.get(node.taskId)).map(node=>[node.id,node.taskId]));const scheduler=createDagScheduler({store,taskManager:tasks,initialRecord:record,preAttachedTasks:attached});const running=scheduler.run();recordDagHost(runtime,id);controllers.set(id,scheduler);const job=running.catch(error=>{runtime.s.set('scrumNativeDagError:'+id,{message:error.message,at:Date.now()})}).finally(()=>work.delete(id));work.set(id,job);};
 const ownedTasks=(id,parent)=>runtime.s.all("SELECT value FROM settings WHERE key LIKE 'scrumDagTask:%'").map(row=>JSON.parse(row.value)).filter(t=>t.parent_session_id===parent&&t.owner?.runId===id);
 return {manager,
 snapshot(parent){return manager.list(parent).map(run=>({id:run.runId,mode:'mass-ulw',status:run.status==='completed'&&ownedTasks(run.runId,parent).every(t=>t.cleanupComplete)?'done':run.status==='completed'?'verification':run.status}));},
 async handle({args={},parentSession,callerSession}){if(closed)throw Error('DAG runtime closed');if(!parentSession||callerSession&&callerSession!==parentSession)throw Error('DAG operations are lead-only');const op=args.action||'list';if(['start','retry','amend','send','attach','recover'].includes(op)&&executionStopped(runtime.state(parentSession)))throw Error('Stopped parent cannot start DAG work');
 if(op==='recover'){const key='scrumDagRecovery:'+parentSession;if(recoveryWork.has(parentSession))return runtime.s.setting(key);const crashRecovery=pauseCrashedDagRuns(runtime,store,manager,parentSession);runtime.s.set(key,{status:'running',started:Date.now(),crashRecovery});const job=recovery.resumePausedRuns(parentSession).then(outcomes=>runtime.s.set(key,{status:'completed',outcomes,crashRecovery,finished:Date.now()})).catch(error=>runtime.s.set(key,{status:'failed',error:error.message,finished:Date.now()})).finally(()=>recoveryWork.delete(parentSession));recoveryWork.set(parentSession,job);return {status:'running',receipt:key};}
 if(op==='recovery_status')return runtime.s.setting('scrumDagRecovery:'+parentSession,null);
 if(op==='list')return manager.list(parentSession);
 if(op==='start'){const result=await manager.start({definition:args.definition,parentSessionId:parentSession,rootSessionId:parentSession});if(!result.reused)drive(result.snapshot.runId,parentSession);return result;}
 const id=args.run_id;manager.record(id,parentSession);
 if(op==='inspect')return manager.snapshot(id,parentSession);
 if(op==='history')return manager.history({runId:id,parentSessionId:parentSession,sinceSeq:args.since_seq,limit:args.limit||100});
 if(op==='attach'){drive(id,parentSession);return manager.snapshot(id,parentSession);}
 if(op==='amend'){await manager.amend({runId:id,parentSessionId:parentSession,definition:args.definition});drive(id,parentSession);return manager.snapshot(id,parentSession);}
 if(op==='retry'){const scheduler=controllers.get(id)||createDagScheduler({store,taskManager:tasks,initialRecord:manager.record(id,parentSession)});const next=scheduler.retryNode(id,args.node_ids,args.prompt?{prompt:args.prompt}:undefined);recordDagHost(runtime,id);controllers.set(id,next.scheduler);const job=next.run.catch(error=>runtime.s.set('scrumNativeDagError:'+id,{message:error.message,at:Date.now()})).finally(()=>work.delete(id));work.set(id,job);return next.record;}
 if(op==='send'){const scheduler=controllers.get(id)||createDagScheduler({store,taskManager:tasks,initialRecord:manager.record(id,parentSession)});return scheduler.sendToNode(id,args.node_id,args.message);}
 if(op==='cancel'||op==='cleanup'){const scheduler=controllers.get(id);if(scheduler&&op==='cancel')await scheduler.cancel(id,'Parent requested cancellation');for(const task of ownedTasks(id,parentSession))await tasks.cancelTask(task.task_id,'Owned DAG cleanup');await work.get(id);return manager.snapshot(id,parentSession);}
 throw Error('Unknown DAG action');},
 async stop(parent){for(const run of manager.list(parent)){const scheduler=controllers.get(run.runId);if(scheduler&&!['completed','failed','cancelled'].includes(run.status))await scheduler.cancel(run.runId,'Parent stopped');for(const task of ownedTasks(run.runId,parent))if(!task.cleanupComplete)await tasks.cancelTask(task.task_id,'Parent stopped');await work.get(run.runId)}},
 async close(){closed=true;await Promise.all([...controllers.values()].map(c=>c.suspend()));for(const parent of new Set([...controllers.values()].map(c=>c.snapshot().parentSessionId)))recovery.pauseRunsForShutdown(parent);await Promise.allSettled([...work.values(),...recoveryWork.values()]);unobserve();}
 };
}
