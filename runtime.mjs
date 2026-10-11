import {executionContext} from './execution-store.mjs';
import {installNativeConfiguration} from './installer-config.mjs';
import {managedWorkflowActivity} from './managed-workflow-activity.mjs';
import {readDeliveryGates} from './delivery-gates.mjs';
import {createNativeDagRuntime} from './dag-runtime.mjs';
import {handleUlwToolkit,ulwToolkitWorkflows} from './ulw-toolkit.mjs';
import {callLookupAgent} from './call-agent.mjs';
import {backgroundOutput} from './background-output.mjs';
import {accountGoalUsage} from './goal-usage.mjs';
import {createWorkpoolRuntime,readWorkpools} from './workpool.mjs';
import {planContinuation} from './plan-continuation.mjs';
import {getRuntimeFallbackStatusCode,getRuntimeFallbackRetryableSignal} from './independent/request-classification.mjs';
import {TeamStore} from './team.mjs';
import {workflowMethods,handleWorkflow,reconcileWorkflows,WorkflowStore} from './workflow.mjs';
import {ThreadStore,threadMethods,handleThread} from './thread.mjs';
import {relayMethods,handleRelay} from './relay.mjs';
import {captureArtifact} from './artifacts.mjs';
import {teamDagMethods,handleTeamDag,tickDags} from './dag.mjs';
import {ScrumEvents,monitorTick} from './events.mjs';
import {taskApi,taskMethods} from './task-api.mjs';
import {routeTask} from './categories.mjs';
import {randomUUID,createHash} from 'node:crypto';
import {realpath} from 'node:fs/promises';
import {resolve,relative,sep} from 'node:path';
import {roleInstruction,rolePolicy} from './roles.mjs';
import {projectIds,readExecutionState,executionStopped} from './controller.mjs';
import {start,pause,settle} from './controller.mjs';
import {ParentReports} from './parent-reports.mjs';
import {selectModel,fallbackModels,mayRetryModel} from './models.mjs';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};
const text=(v,label,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max)fail(label+'を確認してください');return v.trim()};
const terminal=['done','cancelled','reported'];
export class ScrumCoordinator{
 async workflowLastActivity(id,parent){return managedWorkflowActivity(this,id,parent)}
 schedule(delay=150){if(this.timer||this.closed)return;this.timer=setTimeout(()=>{this.timer=null;this.tick().catch(error=>this.s.set('scrumRuntimeError',{message:error.message,stack:error.stack,at:Date.now()}))},delay);this.timer.unref?.()}
 async close(){this.closed=true;clearTimeout(this.timer);await this.nativeDags?.close();await this.workpools?.close();await this.tickWork?.catch(()=>{})}
 ownerOf(sessionId){const assignment=this.list().find(a=>a.runId===sessionId),thread=(this.threads||new ThreadStore(this.s,this.threadAdapter||{})).owner(sessionId);if(assignment&&thread&&assignment.parentSession!==thread.parentSession)throw Error('Ambiguous session ownership');return assignment||thread||null}
 state(parent){return readExecutionState(this.s,parent)}
 adapter(finalChecks=[],parent){return {readState:()=>this.state(parent),writeState:state=>this.s.set(parent?'ulw:'+parent:'ulw',state),snapshot:()=>({...this.s.snapshot(),tasks:this.s.snapshot().tasks.filter(t=>!this.s.executionOnly||t.parentSession===parent),deliveryGates:parent?readDeliveryGates(this.s).filter(d=>d.parentSession===parent&&d.mode!=='direct').map(d=>({id:d.id,mode:d.mode,completion:new WorkflowStore(this).get(d.id,parent).deliveryCompletion})):[],pendingResourceIds:this.list().filter(a=>(!parent||a.parentSession===parent)&&a.resourcesReleased===false).map(a=>a.id),pendingTodos:parent?(this.pi?.pendingTodos?.(parent)||this.s.setting('scrumParentWait:'+parent,{}).pendingTodos||[]):[],workpools:readWorkpools(this.dir).filter(p=>!parent||p.parent_session_id===parent),workflows:parent?[...new WorkflowStore(this).list(parent),...ulwToolkitWorkflows(this.s,parent),...(this.dir?this.nativeDagRuntime().snapshot(parent):[])]:[],teams:parent?new TeamStore(this.s).list(parent):[],monitors:parent?this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumMonitor:%'").map(r=>JSON.parse(r.value)).filter(m=>m.parentSession===parent):[],assignments:this.list().filter(a=>!parent||a.parentSession===parent),finalChecks})}}
 async settle(parent){
  await reconcileWorkflows(this);
  const ids=projectIds(this.adapter([],parent));if(!ids)return this.state(parent);
  const checks=[];
  for(const p of this.s.snapshot().projects.filter(p=>ids.has(p.id))){
   try{const actual=await this.artifact({projectId:p.id,output:p.output});const recorded=this.s.all('SELECT * FROM deliverables WHERE projectId=? AND reviewed=1',p.id);checks.push({projectId:p.id,verified:recorded.some(r=>r.path===actual.path&&r.hash===actual.hash),path:actual.path,hash:actual.hash})}
   catch(error){checks.push({projectId:p.id,verified:false,error:error.message})}
  }
  const result=settle(this.adapter(checks,parent));if(this.state(parent).stopReason!=='parent-session-deleted')await this.syncNativeGoal?.(parent);return result;
 }
 connectParent({deliver,isBusy,requestPlan,connectionForWorker}){this.reports.onPending=()=>this.schedule();this.reports.deliver=deliver;this.reports.isBusy=isBusy;this.requestPlan=requestPlan;this.connectionForWorker=connectionForWorker;}
 tick(){if(this.tickWork)return this.tickWork;this.tickWork=this.runTick().finally(()=>{this.tickWork=null});return this.tickWork;}
 async stopTeamMembers(){
  for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumTeamStop:%'")){
   const pending=JSON.parse(row.value);if(pending.status!=='pending')continue;if(pending.nextAt>Date.now()){this.schedule(Math.min(1000,pending.nextAt-Date.now()));continue}if(await this.reports.isBusy(pending.parentSession)){this.schedule(1000);continue}
   try{
    const assignments=this.list().filter(a=>a.parentSession===pending.parentSession&&a.runId===pending.sessionId),threads=this.threads||new ThreadStore(this.s,this.threadAdapter||{}),thread=threads.list(pending.parentSession).find(t=>t.sessionId===pending.sessionId);
    if(!assignments.length&&!thread)throw Error('Team member execution is not managed by this parent');
    if(assignments.some(a=>a.status==='uncertain'))throw Error('Reconcile uncertain member execution before shutdown');
    for(const a of assignments.filter(a=>['running','preparing'].includes(a.status)))await this.stop(a.id);
    if(thread&&thread.status!=='interrupted')await threads.handle({method:'thread_interrupt',args:{thread:thread.id,discardInbox:true},parentSession:pending.parentSession});
    new TeamStore(this.s).update(pending.teamId,pending.parentSession,t=>{const member=t.members.find(m=>m.name===pending.member&&m.sessionId===pending.sessionId);if(!member)throw Error('Team member changed during shutdown');member.status='stopped';const request=t.shutdownRequests.find(r=>r.id===pending.id);request.stoppedAt=Date.now();delete request.stopError;const key='scrumMailbox:'+pending.parentSession,id='shutdown-completed:'+pending.id,mail=this.s.setting(key,[]);if(!mail.some(m=>m.id===id))this.s.set(key,[...mail,{id,kind:'shutdown_completed',from:pending.sessionId,to:pending.parentSession,message:JSON.stringify({kind:'shutdown_completed',teamId:pending.teamId,member:pending.member,requestId:pending.id}),created:Date.now(),read:false}]);this.s.set('scrumContinue:'+pending.parentSession,true)});
    this.s.set(row.key,{...pending,status:'completed',completed:Date.now()});
   }catch(error){this.s.set(row.key,{...pending,error:error.message,nextAt:Date.now()+1000});this.schedule(1000);new TeamStore(this.s).update(pending.teamId,pending.parentSession,t=>{const request=t.shutdownRequests.find(r=>r.id===pending.id);if(request)request.stopError=error.message})}
  }
 }
 async deliverWorkerMail(){
  const workers=new Map();for(const a of this.list())if(!workers.has(a.runId))workers.set(a.runId,a);
  for(const a of workers.values()){
   const key='scrumMailbox:'+a.runId,batchKey='scrumMailDelivery:'+a.runId;
   let batch=this.s.setting(batchKey,null);
   if(batch){
    let op=this.s.setting('pi-send:'+batch.id,null);
    if(op&&['accepted','submitting','uncertain'].includes(op.status)&&this.pi?.reconcileDispatch){try{await this.pi.reconcileDispatch(batch.id);op=this.s.setting('pi-send:'+batch.id,null)}catch(error){this.s.set(batchKey,{...batch,error:error.message});continue}}
    if(op?.status==='completed'){
     this.s.tx(()=>{this.s.set(key,this.s.setting(key,[]).map(m=>batch.messageIds.includes(m.id)?{...m,read:true,deliveredAt:Date.now(),deliveryId:batch.id}:m));this.s.set(batchKey,null)});
     batch=null;
    }else if(op){
     this.s.set(batchKey,{...batch,status:op.status,error:op.error||null});
     // An accepted or ambiguous dispatch must never be sent again. Failed turns
     // remain unread for explicit reconciliation rather than repeated side effects.
     continue;
    }
   }
   if(executionStopped(this.state(a.parentSession))||['done','cancelled','running','preparing','uncertain'].includes(a.status)||await this.reports.isBusy(a.parentSession))continue;
   if(!batch){
    const messages=this.s.setting(key,[]).filter(m=>!m.read);if(!messages.length)continue;
    batch={id:'mail:'+randomUUID(),messageIds:messages.map(m=>m.id),message:messages.map(m=>m.message).join('\n\n'),status:'reserved',created:Date.now()};
    this.s.set(batchKey,batch);
   }
   try{const result=await this.followup(a.runId,batch.message,batch.id);if(result)this.s.set(batchKey,{...batch,status:result.status||'accepted'});}
   catch(error){this.s.set(batchKey,{...batch,status:this.s.setting('pi-send:'+batch.id,null)?.status||'reserved',error:error.message});this.schedule(1000)}
  }
 }
 async deliverThreadMail(){
  const threads=this.threads||new ThreadStore(this.s,this.threadAdapter||{}),rows=this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumThread:%'"),workers=new Set(this.list().map(a=>a.runId));
  for(const {value}of rows){const thread=JSON.parse(value);if(workers.has(thread.sessionId))continue;
   const key='scrumMailbox:'+thread.sessionId,batchKey='scrumMailDelivery:'+thread.sessionId;let batch=this.s.setting(batchKey,null);
   try{
    if(batch){
     if(batch.messageIds.every(id=>this.s.setting(key,[]).some(m=>m.id===id&&m.read))){this.s.set(batchKey,null);batch=null;}
     else if(typeof threads.adapter.receipt==='function'){
      const proof=await threads.capability('receipt',thread,{operationId:batch.id});
      if(proof.status==='completed'){this.s.tx(()=>{this.s.set(key,this.s.setting(key,[]).map(m=>batch.messageIds.includes(m.id)?{...m,read:true,deliveryId:batch.id,deliveredAt:Date.now()}:m));this.s.set(batchKey,null)});batch=null;}
      else if(this.s.setting('scrumThreadReceipt:'+thread.parentSession+':'+batch.id,null)){this.s.set(batchKey,{...batch,status:proof.status,error:proof.error||null});continue;}
     }else continue;
    }
    if(executionStopped(this.state(thread.parentSession))||thread.status==='interrupted')continue;
    const messages=this.s.setting(key,[]).filter(m=>!m.read);if(!batch&&!messages.length)continue;
    const view=await threads.capability('read',thread,{limit:1});if(['running','submitting','retrying','waiting_input','uncertain'].includes(view.status))continue;
    if(!batch){batch={id:'mail:'+randomUUID(),messageIds:messages.map(m=>m.id),message:messages.map(m=>m.message).join('\n\n'),status:'reserved',created:Date.now()};this.s.set(batchKey,batch);}
    await threads.handle({method:'thread_send',args:{thread:thread.id,message:batch.message,idempotency_key:batch.id},parentSession:thread.parentSession});this.s.set(batchKey,{...batch,status:'accepted'});
   }catch(error){if(batch)this.s.set(batchKey,{...batch,error:error.message});this.schedule(1000)}
  }
 }
 async cleanupDeletedParent(parent){
  await this.workpools?.stop(parent);
  for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumWorkflow:%'")){const workflow=JSON.parse(row.value);if(workflow.parentSession===parent)this.s.set(row.key,{...workflow,status:'paused',stoppedReason:'parent-session-deleted'})}
   this.s.set('ulw:'+parent,{...this.state(parent),phase:'stopped',active:false,stopReason:'parent-session-deleted'});
   this.s.set('scrumQueue:'+parent,[]);this.s.set('scrumContinue:'+parent,false);
   await this.nativeDags?.stop(parent);
   for(const report of this.reports.all().filter(r=>r.parentSession===parent&&r.state==='pending'))this.s.set('scrumReport:'+report.id,{...report,state:'orphaned'});
    for(const a of this.list().filter(a=>a.parentSession===parent&&['running','preparing'].includes(a.status)))await this.stop(a.id);
    if(this.list().some(a=>a.parentSession===parent&&a.status==='uncertain'))throw Error('Reconcile uncertain orphan execution before cleanup');
    const threads=this.threads||new ThreadStore(this.s,this.threadAdapter||{});
    for(const thread of threads.list(parent).filter(t=>t.status!=='interrupted'))await threads.handle({method:'thread_interrupt',args:{thread:thread.id,discardInbox:true},parentSession:parent});
    for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumMonitor:%'")){const monitor=JSON.parse(row.value);if(monitor.parentSession===parent)this.s.set(row.key,{...monitor,active:false})}
 }
 async reconcileTeamSessions(){
  if(typeof this.pi.sessionExists!=='function')return;
  const teams=new TeamStore(this.s);
  for(const team of teams.list().filter(t=>['active','orphaned'].includes(t.status))){
   let parentDeleted=team.status==='orphaned';
   for(const id of new Set([team.parentSession,...team.members.filter(m=>m.status!=='stopped').map(m=>m.sessionId)])){
    const key='scrumSessionPresence:'+id;let exists;
    try{exists=await this.pi.sessionExists(id)}catch(error){this.s.set('scrumSessionProbeError:'+id,{error:error.message,at:Date.now()});continue}
    if(exists===true){this.s.set(key,{present:true,at:Date.now()});continue}
    if(exists!==false)continue;
    if(!this.s.setting(key,null)?.present)continue; // Unknown is not deletion.
    if(id===team.parentSession)parentDeleted=true;
    else try{
     for(const a of this.list().filter(a=>a.parentSession===team.parentSession&&a.runId===id&&['running','preparing'].includes(a.status)))await this.stop(a.id);
     if(this.list().some(a=>a.parentSession===team.parentSession&&a.runId===id&&a.status==='uncertain'))throw Error('Deleted member execution remains uncertain');
     const threads=this.threads||new ThreadStore(this.s,this.threadAdapter||{});for(const thread of threads.list(team.parentSession).filter(t=>t.sessionId===id&&t.status!=='interrupted'))await threads.handle({method:'thread_interrupt',args:{thread:thread.id,discardInbox:true},parentSession:team.parentSession});
     teams.update(team.id,team.parentSession,t=>{const member=t.members.find(m=>m.sessionId===id);if(member){member.status='stopped';member.executionStatus='deleted';member.stoppedAt=Date.now();delete member.cleanupError;for(const [task,claim]of Object.entries(t.claims))if(claim.member===member.name)delete t.claims[task];const key='scrumMailbox:'+t.parentSession;this.s.set(key,[...this.s.setting(key,[]),{id:randomUUID(),from:id,to:t.parentSession,kind:'member_deleted',message:JSON.stringify({kind:'member_deleted',teamId:t.id,member:member.name}),created:Date.now(),read:false}]);this.s.set('scrumContinue:'+t.parentSession,true)}});
    }catch(error){teams.update(team.id,team.parentSession,t=>{const member=t.members.find(m=>m.sessionId===id);if(member)member.cleanupError=error.message});this.schedule(1000)}
   }
   if(!parentDeleted)continue;
   teams.update(team.id,team.parentSession,t=>{t.status='orphaned'});
   try{
    await this.cleanupDeletedParent(team.parentSession);
    for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumTeamStop:%'")){const stop=JSON.parse(row.value);if(stop.teamId===team.id&&stop.status==='pending')this.s.set(row.key,{...stop,status:'completed',reason:'parent-session-deleted'})}
    teams.update(team.id,team.parentSession,t=>{t.status='deleted';t.claims={};for(const member of t.members)member.status='stopped';t.deletedReason='parent-session-deleted';delete t.cleanupError});
   }catch(error){teams.update(team.id,team.parentSession,t=>{t.cleanupError=error.message});this.schedule(1000)}
  }
  const parents=new Set([...this.list().map(a=>a.parentSession),...readWorkpools(this.dir).map(p=>p.parent_session_id)]);
  for(const row of this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumWorkflow:%' OR key LIKE 'scrumMonitor:%'")){const value=JSON.parse(row.value);if(value.parentSession)parents.add(value.parentSession)}
  const teamParents=new Set(teams.list().map(t=>t.parentSession));
  for(const parent of parents){if(!parent||teamParents.has(parent))continue;try{const exists=await this.pi.sessionExists(parent),key='scrumSessionPresence:'+parent;if(exists===true)this.s.set(key,{present:true,at:Date.now()});else if(exists===false&&this.s.setting(key,null)?.present){await this.cleanupDeletedParent(parent);this.s.set('scrumParentCleanup:'+parent,{status:'completed',at:Date.now()})}}catch(error){this.s.set('scrumParentCleanup:'+parent,{status:'retry',error:error.message,at:Date.now()});this.schedule(1000)}}
 }
 async runTick(){
  if(this.closed)return;
  for(const pool of readWorkpools(this.dir)){if(executionStopped(this.state(pool.parent_session_id)))await this.workpoolRuntime().stop(pool.parent_session_id);else this.workpoolRuntime().engine.attach({sessionId:pool.parent_session_id,rootSessionId:pool.root_session_id,depth:0,cwd:this.threadCwd?.(pool.parent_session_id)||this.dir})}
  await this.reconcileTeamSessions();
  await this.stopTeamMembers();
  for(const a of this.list().filter(a=>['done','ready'].includes(a.status)&&a.resourcesReleased===false)){try{await this.pi.release?.(a.runId);this.save(a,{resourcesReleased:true,resourceCleanupError:null})}catch(error){this.save(a,{resourceCleanupError:error.message})}}
  await this.collect();await tickDags(this);await reconcileWorkflows(this);await monitorTick(this);await this.reports.flush();
  for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumQueue:%'")){const parent=row.key.slice('scrumQueue:'.length),queue=JSON.parse(row.value);if(!queue.length||await this.reports.isBusy(parent))continue;await this.dispatch(queue,parent);const started=new Set(this.list().filter(a=>a.parentSession===parent&&!['done','cancelled'].includes(a.status)).map(a=>a.taskId));this.s.set(row.key,queue.filter(p=>!started.has(p.taskId)&&!['done','cancelled'].includes(this.s.snapshot().tasks.find(t=>t.id===p.taskId)?.status)));}

  for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumCancelQueue:%'")){const parent=row.key.slice('scrumCancelQueue:'.length);if(await this.reports.isBusy(parent))continue;for(const id of JSON.parse(row.value)){const a=this.list().find(a=>a.id===id&&a.parentSession===parent);if(a&&['running','preparing'].includes(a.status))await this.stop(id)}this.s.set(row.key,[]);}
  await this.deliverWorkerMail();
  await this.deliverThreadMail();
  if(this.closed)return;
   for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'ulw:%'"))await this.settle(row.key.slice(4));
   if(this.requestPlan)for(const row of this.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumContinue:%'")){
    const pending=JSON.parse(row.value);if(!pending||pending.nextAt>Date.now())continue;const parent=row.key.slice('scrumContinue:'.length);if(executionStopped(this.state(parent))){this.s.set(row.key,false);continue}if(await this.reports.isBusy(parent))continue;
    await this.continueParent(parent);
   }
 }
 parentInput(parent){this.s.set('scrumContinuation:'+parent,{});this.s.set('scrumContinue:'+parent,false)}
 parentIdle(parent,{reason='completed',pendingQuestion=false,pendingTodos}={},now=Date.now()){
  this.s.set('scrumParentWait:'+parent,{pendingQuestion,reason,pendingTodos:pendingTodos??this.s.setting('scrumParentWait:'+parent,{}).pendingTodos??[],at:now});
  const state=this.state(parent);
  if(!['completed','max-tokens'].includes(reason)||pendingQuestion)this.s.set('scrumContinue:'+parent,false);
  if(!state.active||executionStopped(state)||state.phase==='blocked'||!['completed','max-tokens'].includes(reason)||pendingQuestion)return {armed:false};
  const scope=projectIds(this.adapter([],parent));if(!this.s.executionOnly&&!scope?.size)return {armed:false};
  const pending=this.s.setting('scrumContinue:'+parent,false);
  if(!pending)this.s.set('scrumContinue:'+parent,{nextAt:now+2000,source:'parent-idle'});
  this.schedule();return {armed:true};
 }
 async continueParent(parent,now=Date.now()){
  const key='scrumContinuation:'+parent,old=this.s.setting(key,{});
  if(executionStopped(this.state(parent))){this.s.set('scrumContinue:'+parent,false);return {blocked:true,reason:'stopped'}}
  if(this.pi?.pendingQuestion?.(parent)||this.s.setting('scrumParentWait:'+parent,{}).pendingQuestion){this.s.set('scrumContinue:'+parent,false);return {waiting:true,reason:'pending-question'}}
  if(this.list().some(a=>a.parentSession===parent&&['running','preparing','uncertain'].includes(a.status))||await this.reports.isBusy(parent)){this.s.set('scrumContinue:'+parent,{nextAt:now+5000});return {waiting:true,reason:'execution-active'}}
  const compact=this.pi?.compactionState?.(parent)||this.s.setting('scrumCompaction:'+parent,null);
  if(compact&&compact.acknowledgedEpoch!==compact.epoch&&now-compact.startedAt<60000){this.s.set('scrumContinue:'+parent,{nextAt:Math.min(compact.startedAt+60000,now+5000)});return {waiting:true,reason:'compaction'}}
  if(old.unrecoverable){this.s.set('scrumContinue:'+parent,false);return {blocked:true,reason:'unrecoverable-request'}}
  const planned=planContinuation((this.workflows||new WorkflowStore(this)).context(parent),old.planContinuation);
  if(planned.blocked){this.s.set('scrumContinue:'+parent,false);this.events.append(parent,'continuation.blocked',{reason:planned.blocked});return {blocked:true,reason:planned.blocked}}
  const scope=projectIds(this.adapter([],parent)),snapshot=this.s.snapshot();
  const signature=JSON.stringify({pendingTodos:this.adapter([],parent).snapshot().pendingTodos,plan:planned.next?.signature||old.planContinuation?.signature,tasks:snapshot.tasks.filter(t=>this.s.executionOnly?t.parentSession===parent:!scope||scope.has(t.projectId)).map(t=>({id:t.id,status:t.status,title:t.title,output:t.output,completionCriteria:t.completionCriteria,body:t.body,inputs:t.inputs,nextAction:t.nextAction,dependencies:t.dependencies,completionEvidence:t.completionEvidence})),assignments:this.list().filter(a=>a.parentSession===parent).map(a=>({id:a.id,status:a.status,hash:a.artifact?.hash}))});
  const progress=old.signature!==signature,state={...old,signature,stagnation:progress?0:old.awaitingProgress?(old.stagnation||0)+1:old.stagnation||0,awaitingProgress:false};
  if(now-(old.failureAt||0)>300000)state.failures=0;
  if(state.stagnation>=3||state.failures>=5){state.blockReason=state.stagnation>=3?'stagnation':'consecutive-failures';this.s.set(key,state);this.s.set('scrumContinue:'+parent,false);this.events.append(parent,'continuation.blocked',{reason:state.blockReason});return {blocked:true,reason:state.blockReason}}
  if(old.lastInjectedAt&&now-old.lastInjectedAt<5000){this.s.set('scrumContinue:'+parent,{nextAt:old.lastInjectedAt+5000});return {waiting:true}}
  this.s.set(key,state);this.s.set('scrumContinue:'+parent,false);
  try{await this.requestPlan(parent);this.s.set(key,{...state,...(planned.next?{planContinuation:planned.next}:{}),awaitingProgress:true,lastInjectedAt:now,failures:0,blockReason:null});return {requested:true}}
  catch(error){const unrecoverable=[400,422].includes(getRuntimeFallbackStatusCode(error))&&getRuntimeFallbackRetryableSignal(error)===false;this.s.set(key,{...state,unrecoverable,failures:(state.failures||0)+1,failureAt:now,error:error.message});this.s.set('scrumContinue:'+parent,unrecoverable?false:{nextAt:now+60000});throw error}
 }
 nativeDagRuntime(){return this.nativeDags||=createNativeDagRuntime(this)}
 workpoolRuntime(){this.workpools||=createWorkpoolRuntime(this,{waitForIdle:(id,signal)=>this.threadAdapter.waitForIdle(id,signal),deliver:async(parent,message)=>{if(await this.reports.isBusy(parent))throw Error('Parent is busy');if(!this.reports.deliver)throw Error('Parent delivery unavailable');await this.reports.deliver(parent,{id:message.pool_id+':'+message.generation,reports:[{id:message.pool_id+':'+message.generation,parentSession:parent,status:'review',result:JSON.stringify(message),verified:false}],wake:true,allFinished:true})}});return this.workpools}
 async handle({method,args={},parentSession,callerSession}){
  if(method==='activate'){
 if(callerSession||!parentSession||!this.s.executionOnly)fail('Parent execution activation required');
 const previous=this.state(parentSession),key='scrumActivation:'+parentSession;const boundaryKey='scrumActivationBoundary:'+parentSession;if(args.afterHumanCount!==undefined)this.s.set(boundaryKey,args.afterHumanCount);if(args.humanCount!==undefined&&args.humanCount<=this.s.setting(boundaryKey,-1))return previous;if(args.activationId&&this.s.setting(key,null)===args.activationId)return previous;
 if(previous.active&&(!args.goal||previous.goal===args.goal)){if(args.activationId)this.s.set(key,args.activationId);return previous;}
 const state=start(this.adapter([],parentSession),{...args,goal:args.goal||'',concurrency:args.concurrency??previous.concurrency??2});if(args.activationId)this.s.set(key,args.activationId);return state;
 }
  if(method==='native_workflow')return this.nativeDagRuntime().handle({args,parentSession,callerSession});
  if(method==='ulw_toolkit')return handleUlwToolkit(this,{args,parentSession,callerSession});
  if(method==='goal_usage'){if(!parentSession||args.sessionId!==(callerSession||parentSession))throw Error('Usage source outside caller');return accountGoalUsage(this.s,parentSession,args)}
  if(method==='goal_usage_status'){const state=this.state(parentSession);return {tokensUsed:state.tokensUsed||0,timeUsedSeconds:state.timeUsedSeconds||0,usageAvailability:state.usageAvailability||'complete',usageUnavailableEvents:state.usageUnavailableEvents||0}}
  if(method==='workpool'){if(!parentSession)fail('Parent required');return this.workpoolRuntime().handle({args,parentSession,callerSession})}
  if(method==='call_omo_agent'){if(callerSession)fail('担当から利用できないScrum操作です');return callLookupAgent(this,args,parentSession)}
  if(threadMethods.includes(method))return handleThread(this,{method,args,parentSession,callerSession});
  if(relayMethods.includes(method))return handleRelay(this,{method,args,parentSession,callerSession});
  if(workflowMethods.includes(method))return handleWorkflow(this,{method,args,parentSession,callerSession});
  if(teamDagMethods.includes(method))return handleTeamDag(this,{method,args,parentSession,callerSession});
  if(taskMethods.includes(method)){if(callerSession&&!['team_send','team_messages'].includes(method))fail('担当から利用できないScrum操作です');return taskApi(this,method,args,parentSession,callerSession);}
  if(callerSession)fail('担当から利用できないScrum操作です');
  if(method==='installer_config'){const catalog=this.s.setting('workerModelCatalog',[]);return installNativeConfiguration(this.s,args,parentSession,{hostCatalog:Array.isArray(catalog)&&catalog.length?catalog:undefined})}
  if(!['status','list','output','start','pause','stop-continuation','compaction_guard','parent_idle','parent_input','resume','delegate','stop','retry'].includes(method))fail('未対応のScrum操作です');
  const owned=this.list().filter(a=>a.parentSession===parentSession);
  if(method==='parent_input'){this.parentInput(parentSession);return {reset:true}}
  if(method==='parent_idle'){if(typeof args.reason!=='string'||typeof args.pendingQuestion!=='boolean'||args.pendingTodos!==undefined&&(!Array.isArray(args.pendingTodos)||args.pendingTodos.some(t=>typeof t?.content!=='string'||!['pending','in_progress'].includes(t.status))))fail('Invalid parent idle observation');return this.parentIdle(parentSession,args)}
  if(method==='compaction_guard'){if(!['begin','end'].includes(args.action)||!Number.isSafeInteger(args.epoch)||args.epoch<1)fail('Invalid compaction guard');const key='scrumCompaction:'+parentSession,old=this.s.setting(key,{});if(args.action==='begin')this.s.set(key,{epoch:(old.epoch||0)+1,startedAt:Date.now()});else if(old.epoch===args.epoch)this.s.set(key,{...old,acknowledgedEpoch:args.epoch});return this.s.setting(key,{})}
  if(method==='status')return {...this.state(parentSession),workerModels:this.s.setting('workerModels',{default:selectModel()}),assignments:owned.map(a=>{const task=this.s.get('SELECT title,waitReason,waitingFor FROM tasks WHERE id=?',a.taskId);return {...a,title:task?.title,waitReason:task?.waitReason,waitingFor:task?.waitingFor}}),reports:this.reports.all().filter(r=>r.parentSession===parentSession)};
  if(method==='list')return owned;
  if(method==='output')return backgroundOutput(this,args,parentSession);
  if(method!=='stop-continuation'&&await this.reports.isBusy(parentSession))fail('親の応答が終わってから操作してください',409);
  if(method==='pause'||method==='stop-continuation'){let state=pause(this.adapter([],parentSession));if(method==='stop-continuation'){state={...state,phase:'stopped',stoppedAt:Date.now()};this.s.set('ulw:'+parentSession,state)}await this.nativeDags?.stop(parentSession);await this.workpools?.stop(parentSession);this.s.set('scrumQueue:'+parentSession,[]);this.s.set('scrumContinue:'+parentSession,false);const threads=this.threads||new ThreadStore(this.s,this.threadAdapter||{}),children=this.s.all?threads.list(parentSession).filter(t=>t.status!=='interrupted'):[];const stops=await Promise.allSettled([...owned.filter(a=>['running','preparing'].includes(a.status)).map(a=>this.stop(a.id)),...children.map(t=>threads.handle({method:'thread_interrupt',args:{thread:t.id,discardInbox:true},parentSession}))]);const errors=stops.filter(r=>r.status==='rejected');if(errors.length)fail(errors.map(r=>r.reason.message).join('; '),409);await this.syncNativeGoal?.(parentSession);return state;}
  if(method==='start'||method==='resume'){
   if(!this.requestPlan)fail('親の計画処理が未接続です');const previous=this.state(parentSession);if(method==='resume'&&previous.phase==='completed')fail('完了した計画は再開できません');
   this.s.set('scrumContinuation:'+parentSession,{});const state=start(this.adapter([],parentSession),method==='resume'?{...previous,projectId:previous.projectIds?.[0]}:args);
   try{await this.syncNativeGoal?.(parentSession);await this.requestPlan(parentSession,state,{queueOnly:true})}catch(error){this.s.set('ulw:'+parentSession,previous);throw error}return state;
  }
  if(method==='delegate'){if(!Array.isArray(args.picks))fail('委譲は配列で指定してください');await this.dispatch(args.picks,parentSession);return this.list().filter(a=>a.parentSession===parentSession);}
  if(!owned.some(a=>a.id===args.assignmentId))fail('この親に委譲された担当ではありません');
  await this[method](args.assignmentId);return {ok:true};
 }
 constructor(store,dir,pi,io){this.io=io;this.s=store;this.dir=dir;this.pi=pi;this.busy=false;store.db.exec(`CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY,taskId TEXT NOT NULL REFERENCES tasks(id),parentSession TEXT NOT NULL,runId TEXT,taskVersion INTEGER NOT NULL,status TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL,updated INTEGER NOT NULL)`);this.io.initRuntime(store);this.events=new ScrumEvents(store);this.reports=new ParentReports(store,{list:()=>this.list()});}
 list(){return this.s.all('SELECT * FROM assignments ORDER BY created DESC,rowid DESC').map(({body,...a})=>{const {body:ignored,...saved}=JSON.parse(body),operation=this.s.setting('pi-send:'+a.id,{});return {...saved,...a,...(operation.startedAt?{startedAt:operation.startedAt}:{}),...(operation.finished?{finishedAt:operation.finished}:{}),activity:this.pi.sessions?.get(a.runId)?.activity||'',runtimeStatus:this.pi.sessions?.get(a.runId)?.status||'',observation:this.io.observation(this.s,{...saved,...a},this.pi.sessions?.get(a.runId))}});}
 save(a,patch){const stored=this.s.get('SELECT status FROM assignments WHERE id=?',a.id);if(stored?.status==='cancelled'&&patch.status&&patch.status!=='cancelled')return {...a,status:'cancelled'};const next={...a,...patch};this.s.run('UPDATE assignments SET runId=?,taskVersion=?,status=?,body=?,updated=? WHERE id=?',next.runId||null,next.taskVersion,next.status,JSON.stringify(next),Date.now(),a.id);if(patch.status&&patch.status!==a.status)this.events.append(a.parentSession,'assignment.transitioned',{assignmentId:a.id,taskId:a.taskId,from:a.status,to:patch.status,artifacts:next.artifact?[{path:next.artifact.path,hash:next.artifact.hash}]:[],verification:{verified:patch.status==='done',reason:next.verification||'',evidence:this.s.get('SELECT completionEvidence FROM tasks WHERE id=?',a.taskId)?.completionEvidence||''}});if(patch.artifact)this.io.observe(this.s,a.id,'artifact_git',{artifacts:'present',git:next.workspace?'changed':'unknown',hash:patch.artifact.hash});if(patch.status==='done')this.io.observe(this.s,a.id,'worker_report',{status:'accepted',outcome:'succeeded',reportId:a.id});if(patch.status&&patch.status!==a.status&&['review','error','conflict','uncertain'].includes(patch.status))this.reports.enqueue(next);return next;}
 async artifact(t,persist=false,runId){
 const p=executionContext(this.s,t),source=await realpath(p.cwd),w=Object.values(this.io.managedSessions(this.s)).find(x=>x.id===runId)?.workspace,base=w?await realpath(w.path):source,output=relative(source,resolve(source,t.output)),path=await realpath(resolve(base,output));if(!path.startsWith(base+sep))fail('成果物がプロジェクト外です');
 return captureArtifact({root:base,path,dataDir:this.dir,persist});
 }
 collect(){if(this.collecting)return this.collecting;this.collecting=this.collectOnce().finally(()=>{this.collecting=null});return this.collecting;}
 async collectOnce(){let changed=false;
 for(const a of this.list().filter(a=>['preparing','running'].includes(a.status))){const op=this.s.setting('pi-send:'+a.id,null);
 if(!op){if(!this.busy){this.save(a,{status:'uncertain',error:'準備中に中断しました。実行記録を確認してください'});changed=true}continue}
 if(['submitting','accepted'].includes(op.status)){
  const timeout=this.state(a.parentSession).staleTimeoutMs??3600000;
  if(timeout&&Date.now()-(op.lastEventAt||a.created)<timeout)continue;
  if(!timeout)continue;
  const entry=this.pi.sessions?.get(a.runId);
  if(entry?.rpc){try{await entry.rpc.call('abort',{discardInbox:true},true)}catch(error){this.save(a,{status:'uncertain',error:'停止結果を照合できません：'+error.message});changed=true;continue}}
  this.save(a,{status:entry?'error':'uncertain',error:'担当の活動が停止しています。途中成果物を確認してください'});changed=true;continue;
 }
 if(op.status==='failed'&&mayRetryModel(op)&&a.instruction&&a.fallbacks?.[a.fallbackIndex||0]){
  const next=a.fallbacks[a.fallbackIndex||0];
  await this.pi.release?.(a.runId);this.s.set('runModel:'+a.runId,next);
  this.save(a,{status:'retrying',fallbackIndex:(a.fallbackIndex||0)+1,attempts:[...(a.attempts||[]),{model:a.model,error:op.error,at:Date.now()}],model:next});
  try{await this.followup(a.runId,a.instruction,randomUUID())}catch(error){this.save(this.list().find(x=>x.runId===a.runId&&x.status!=='cancelled')||a,{status:'error',error:error.message})}changed=true;continue;
 }
 if(op.status!=='completed'){const error=op.error||'Piの実行が完了しませんでした';this.save(a,{status:op.status==='uncertain'?'uncertain':'error',error});const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId);if(t?.version===a.taskVersion&&!terminal.includes(t.status))this.s.task({...t,status:'review',waitReason:'technical',waitingFor:error,checkLocal:new Date().toISOString().slice(0,16),zone:'UTC'});changed=true;continue}
 const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId);if(!t||t.version!==a.taskVersion||terminal.includes(t.status)){this.save(a,{status:'conflict',result:op.result,error:'実行中にタスクが更新されました。結果は保持しています'});changed=true;continue}
 let artifact,error;try{artifact=await this.artifact(t,false,a.runId)}catch(e){error=e.message}
 const currentAssignment=this.s.get('SELECT status,taskVersion FROM assignments WHERE id=?',a.id),currentTask=this.s.snapshot().tasks.find(task=>task.id===a.taskId);
 if(!currentAssignment||!['preparing','running'].includes(currentAssignment.status))continue;
 if(currentAssignment.taskVersion!==a.taskVersion||!currentTask||currentTask.version!==t.version||terminal.includes(currentTask.status)){this.save(a,{status:'conflict',result:op.result||'',error:'成果物の読み込み中にタスクが更新されました。結果は保持しています'});changed=true;continue;}
 this.s.tx(()=>{this.s.task({...currentTask,status:'review',waitReason:'technical',waitingFor:error||'今日のPiが成果物と完了条件を照合中',checkLocal:new Date().toISOString().slice(0,16),zone:'UTC'});
 this.save(a,{status:'review',result:op.result||'',toolEvidence:op.toolEvidence||[],artifact,error,taskVersion:currentTask.version+1});});changed=true;
 }return changed;}
 async review(reviews=[],{human=false}={}){if(!Array.isArray(reviews))fail('結果確認の形式が不正です');
 for(const r of reviews){const a=this.list().find(a=>a.id===r.assignmentId&&a.status==='review');if(!a)fail('確認対象が変更されました',409);const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId);if(!t||t.version!==a.taskVersion||JSON.stringify(executionContext(this.s,t))!==a.project)fail('確認中にタスク・プロジェクトが更新されました',409);const reason=text(r.reason,'確認結果',4000);
 if(r.accept===true){if(!a.artifact||!a.artifact.complete&&!(human&&r.manual===true)||!r.hash||r.hash!==a.artifact.hash)fail('成果物の全内容を確認できていません');const actual=await this.artifact(t,true,a.runId);if(actual.hash!==a.artifact.hash)fail('成果物が変更されました。再確認してください',409);if(this.s.get('SELECT version FROM tasks WHERE id=?',t.id).version!==t.version||JSON.stringify(executionContext(this.s,t))!==a.project)fail('確認中にタスクが更新されました',409);
 if(Object.values(this.io.managedSessions(this.s)).find(x=>x.id===a.runId)?.workspace){this.save(a,{status:'ready',resourcesReleased:false,verification:reason,artifact:{...actual,content:undefined}});await this.pi.release?.(a.runId);this.save(this.list().find(x=>x.id===a.id),{resourcesReleased:true});continue}
 this.s.tx(()=>{this.s.task({...t,status:'done',completionEvidence:'今日のPiによる成果物確認：'+reason+'\n'+actual.path+'\nSHA256 '+actual.hash});const id=randomUUID();this.s.run('INSERT INTO deliverables VALUES(?,?,?,?,?,?)',id,t.projectId,actual.path,actual.hash,1,Date.now());this.s.set('dailyNeedsPlan',true);this.s.set('scrumContinue:'+a.parentSession,true);this.save(a,{status:'done',resourcesReleased:false,verification:reason,artifact:{...actual,content:undefined},taskVersion:t.version+1});});
 await this.pi.release?.(a.runId);this.save(this.list().find(x=>x.id===a.id),{resourcesReleased:true});
 }else{this.save(a,{status:'blocked',verification:reason});this.s.task({...t,status:'review',waitReason:'technical',waitingFor:reason,checkLocal:new Date(Date.now()+86400000).toISOString().slice(0,16),zone:'UTC'});}
 }
 }
 async changes(id){const a=this.list().find(a=>a.id===id);if(!a?.workspace)fail('隔離作業の差分ではありません');return this.io.workspaceChanges(a.workspace)}
 async integrate(id,fingerprint){
 if(this.busy)fail('別の操作を実行中です',409);this.busy=true;try{
 const a=this.list().find(a=>a.id===id);if(!a||a.status!=='ready'||!a.workspace)fail('成果物確認後に統合できます',409);const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId),w=a.workspace;
 if(t?.version!==a.taskVersion||JSON.stringify(executionContext(this.s,t))!==a.project)fail('タスク・案件が変わりました。再確認してください',409);
 if(['running','submitting','retrying','waiting_input'].includes(this.pi.sessions.get(a.runId)?.status))fail('担当Piが実行中です',409);
 const changes=await this.io.workspaceChanges(w);if(changes.fingerprint!==fingerprint)fail('確認後に差分が変わりました',409);
 const head=await this.io.git(w.repo,'rev-parse','HEAD');if(await this.io.git(w.repo,'status','--porcelain'))fail('元フォルダに未コミットの変更があります',409);
 if(head!==w.baseHead&&head!==a.integratedHead)fail('元ブランチが進みました。自動統合せず作業フォルダを保持します',409);
 const actual=await this.artifact(t,false,a.runId);if(actual.hash!==a.artifact.hash)fail('確認後に成果物が変わりました',409);
 if(a.integratedHead&&(await this.io.git(w.root,'rev-parse','HEAD')!==a.integratedHead||await this.io.git(w.root,'status','--porcelain')))fail('統合の再開前に作業フォルダが変わりました。手動で確認してください',409);
 if(!a.integratedHead){await this.io.git(w.root,'add','-A');const tree=await this.io.git(w.root,'write-tree');if(await this.io.git(w.root,'status','--porcelain'))await this.io.git(w.root,'commit','-m','Dashboard task: '+id);if(await this.io.git(w.root,'status','--porcelain')||await this.io.git(w.root,'rev-parse','HEAD^{tree}')!==tree)fail('コミット時に差分が変わりました。再確認してください',409);a.integratedHead=await this.io.git(w.root,'rev-parse','HEAD');this.save(a,{integratedHead:a.integratedHead})}
 if(head!==a.integratedHead)await this.io.git(w.repo,'merge','--ff-only',a.integratedHead);
 const canonical=await this.artifact(t,true);if(canonical.hash!==actual.hash)fail('統合先の成果物を照合できませんでした',409);
 this.s.tx(()=>{this.s.task({...t,status:'done',completionEvidence:a.verification+'\n変更を統合 '+a.integratedHead+'\nSHA256 '+canonical.hash});this.s.run('INSERT INTO deliverables VALUES(?,?,?,?,?,?)',randomUUID(),t.projectId,canonical.path,canonical.hash,1,Date.now());this.save(a,{status:'done',artifact:{...canonical,content:undefined},taskVersion:t.version+1});this.s.set('dailyNeedsPlan',true)});await this.pi.release?.(a.runId);return {ok:true};
 }finally{this.busy=false}
 }
 async followup(runId,message,requestId){
 const a=this.list().find(a=>a.runId===runId&&!['done','cancelled'].includes(a.status));if(!a)return null;
 if(executionStopped(this.state(a.parentSession)))fail('停止・完了した計画には追加指示しません',409);
 if(a.role==='plan-reviewer')fail('計画審査は一回限りです。新しい審査タスクを作成してください');
 const prior=this.s.setting('pi-send:'+requestId,null);if(prior){if(prior.id!==runId||prior.messageHash!==createHash('sha256').update(JSON.stringify(message)).digest('hex'))fail('同じ送信IDで本文・実行先を変更できません',409);return prior;}
 if(['running','preparing','uncertain'].includes(a.status))fail('実行中または結果未照合です。停止・照合後に指示してください',409);
 const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId);if(!t||terminal.includes(t.status))fail('完了済みの作業には追加指示しません',409);
 const project=executionContext(this.s,t);if(JSON.stringify(project)!==a.project)fail('案件が変更されました',409);
 text(message,'追加指示',60000);const id=text(requestId,'送信ID',200),next={...a,id,status:'running',taskVersion:t.version+1,result:null,artifact:null,error:null,verification:null,integratedHead:null};
 this.s.tx(()=>{this.s.task({...t,status:'doing'});this.save(a,{status:'cancelled'});this.s.run('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?)',id,t.id,a.parentSession,runId,next.taskVersion,'running',JSON.stringify(next),Date.now(),Date.now())});
 try{return await this.pi.prompt(runId,message,id,{taskId:t.id,taskVersion:next.taskVersion,cwd:this.s.get('SELECT cwd FROM runs WHERE id=?',runId).cwd})}catch(e){this.save(next,{status:'error',error:e.message});throw e}
 }
 async stop(id){const a=this.list().find(a=>a.id===id);if(!a||!['running','preparing'].includes(a.status))fail('実行中ではありません');const entry=this.pi.sessions?.get(a.runId);if(entry?.rpc)await entry.rpc.call('abort',{discardInbox:true},true);else if(this.pi.abortSession)await this.pi.abortSession(a.runId);else if(a.status!=='preparing')fail('実行プロセスが見つかりません。結果を照合してください');const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId);if(t?.version===a.taskVersion&&!terminal.includes(t.status))this.s.task({...t,status:'waiting',waitReason:'paused',waitingFor:'担当Piの作業を停止',checkLocal:new Date(Date.now()+86400000).toISOString().slice(0,16),zone:'UTC'});this.save(a,{status:'cancelled',error:'停止しました。途中の成果物と履歴は保持しています'});}
 async retry(id,{automatic=false}={}){const a=this.list().find(a=>a.id===id);if(!a||!['error','blocked','conflict','uncertain','cancelled'].includes(a.status))fail('再開できない実行です');if(automatic&&(a.attemptCount||1)>=3)fail('自動再試行を3回実施しました。障害を解消してから手動で再開してください');if(!automatic)this.s.set('scrumManualRetry:'+a.taskId,true);const op=this.s.setting('pi-send:'+id,null);if(op&&['uncertain','submitting','accepted'].includes(op.status))fail('先に担当Piの送信結果を照合してください',409);const t=this.s.snapshot().tasks.find(t=>t.id===a.taskId);if(!t||terminal.includes(t.status))fail('完了・取消済みの作業は再開しません');this.s.task({...t,status:'todo'});this.save(a,{status:'cancelled'});this.s.set('dailyNeedsPlan',true);this.s.set('scrumContinue:'+a.parentSession,true);}
 async foreground(pick,parentSession,{timeoutMs=300000}={}){
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>3600000)fail('待機時間は1〜3600000msです');
 const before=new Set(this.list().map(a=>a.id));
 await this.dispatch([pick],parentSession,{foreground:true});
 const assignment=this.list().find(a=>a.parentSession===parentSession&&a.taskId===pick.taskId&&!before.has(a.id));
 if(!assignment)fail('担当を開始できません。実行中の作業・同時実行数・依存条件を確認してください',409);
 const deadline=Date.now()+timeoutMs;
 for(;;){
  await this.collect();const current=this.list().find(a=>a.id===assignment.id);
  if(!current)fail('担当の実行記録が見つかりません',409);
  if(!['preparing','running','retrying'].includes(current.status))return {queued:false,settled:true,assignmentId:current.id,session_id:current.runId,status:current.status,result:current.result||'',error:current.error||null,artifact:current.artifact||null,verified:current.status==='done'};
  if(Date.now()>=deadline)return {queued:false,settled:false,assignmentId:current.id,session_id:current.runId,status:current.status};
  await new Promise(resolve=>setTimeout(resolve,Math.min(100,deadline-Date.now())));
 }
 }
 async dispatch(picks,parentSession,{foreground=false}={}){
 if(this.busy)return;this.busy=true;try{
 const ulw=this.state(parentSession),scope=projectIds(this.adapter([],parentSession)),limit=ulw.active?ulw.concurrency:1;
 if(executionStopped(ulw))return;
 const active=()=>this.list().filter(a=>a.parentSession===parentSession&&['preparing','running','uncertain'].includes(a.status));
 if(active().some(a=>a.status==='uncertain')||active().length>=limit)return;
 if([...(this.pi.sessions||[])].some(([id,e])=>!(foreground&&id===parentSession)&&!this.list().some(a=>a.runId===id)&&['running','submitting','retrying','waiting_input'].includes(e.status)))return;
 if(!ulw.active&&[...(this.pi.sessions||[])].some(([id,e])=>!(foreground&&id===parentSession)&&['running','submitting','retrying','waiting_input'].includes(e.status)))return;
 for(const raw of picks.filter(p=>p.dispatch===true)){
 if(executionStopped(this.state(parentSession)))break;
 const pick=routeTask(raw,this.s.setting('scrumCategories',{}));
 if(pick.session_id){const existing=this.list().find(a=>a.parentSession===parentSession&&a.runId===pick.session_id&&a.taskId===pick.taskId&&!['done','cancelled'].includes(a.status));if(!existing)fail('この担当セッションを再利用できません');await this.followup(pick.session_id,pick.action,randomUUID());continue;}
 const t=this.s.snapshot().tasks.find(t=>t.id===pick.taskId),p=t&&executionContext(this.s,t);
 if(!t||!p||t.owner!=='Pi'||!t.actionable||p.execution!=='auto'||!p.outcome||!p.completionCriteria||!t.output||(!t.inputs&&!t.body)||!t.completionCriteria||this.list().some(a=>a.taskId===t.id&&!['done','cancelled'].includes(a.status)))continue;
 if(this.s.executionOnly?t.parentSession!==parentSession:scope&&!scope.has(p.id))continue;if(active().length>=limit)break;
 const base=await realpath(p.cwd),target=resolve(base,t.output);if(!target.startsWith(base+sep))fail('タスクの出力先はプロジェクト内にしてください');
 if(this.list().filter(x=>['running','preparing','uncertain'].includes(x.status)).some(x=>!x.workspace&&(this.s.get('SELECT cwd FROM runs WHERE id=?',x.runId)?.cwd||JSON.parse(x.project).cwd)===base))continue;
 const role=pick.role||'executor';roleInstruction(role,base);
 const settings=this.s.setting('workerModels',{}),model=selectModel(settings,role,t.id,pick.category);
 const resource=ulw;
 if(active().filter(x=>x.model?.provider===model.provider).length>=(resource.providerLimits?.[model.provider]??Infinity)||active().filter(x=>x.model?.provider===model.provider&&x.model?.model===model.model).length>=(resource.modelLimits?.[model.provider+'/'+model.model]??Infinity))continue;
 const id=randomUUID(),a={id,role,category:pick.category,skills:pick.skills,model,fallbacks:fallbackModels(settings,role,t.id,pick.category),executionId:t.id,taskId:t.id,parentSession,taskVersion:t.version,status:'preparing',created:Date.now(),project:JSON.stringify(p)};
 this.s.run('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?)',id,t.id,parentSession,null,t.version,'preparing',JSON.stringify(a),Date.now(),Date.now());
 try{
 const previous=this.list().find(x=>x.parentSession===parentSession&&x.taskId===t.id&&x.runId&&['done','cancelled'].includes(x.status));a.attemptCount=this.s.setting('scrumManualRetry:'+t.id,false)?1:(previous?.attemptCount||0)+1;this.s.set('scrumManualRetry:'+t.id,false);
 const run=await this.io.createPiSession(this.s,this.dir,{requestId:id,projectId:t.projectId,title:t.title,taskId:t.id,taskVersion:t.version,runId:previous?.runId||''});
 if(this.list().filter(x=>['running','preparing','uncertain'].includes(x.status)).some(x=>x.id!==id&&(x.workspace?.path||JSON.parse(x.project).cwd)===run.cwd)){this.save(a,{status:'cancelled',error:'同じ作業フォルダの担当を待機'});continue;}
 if(executionStopped(this.state(parentSession))){this.save(a,{runId:run.id,status:'cancelled'});continue;}
 const current=this.s.snapshot().tasks.find(x=>x.id===t.id);if(current.version!==run.context.taskVersion||JSON.stringify(executionContext(this.s,current))!==JSON.stringify(p))fail('委譲の準備中に台帳が変更されました',409);this.s.task({...current,status:'doing',owner:'Pi'});const context={...run.context,taskVersion:current.version+1};
 const actualTarget=resolve(run.cwd,relative(base,target));
 const instruction=roleInstruction(role,base)+'\n'+(pick.skills.length?'使用スキル：'+pick.skills.join(', ')+'。skillツールで読み込む。\n':'')+(rolePolicy(role,base).readOnly?'報告書の保存にはscrum_reportツールを使う。出力先は固定されています。原資料を編集しない。\n':'')+`今日のPiから委譲されたタスクです。タスクの範囲内で実作業と検証を行ってください。AGENTS.mdと適用スキルを読み、他の作業を上書きしない。追加のサブエージェントは起動しない。外部送信・公開・課金・破壊操作・権限変更は行わず、必要なら具体的な障害を報告する。認証情報を出力しない。ダッシュボードのDBや制御APIは操作しない。\nプロジェクトの最終成果：${p.outcome}\n全体の完了条件：${p.completionCriteria}\nタスク：${t.title}\n入力資料：${t.inputs}\nタスク本文：${t.body||''}\n実施内容：${t.nextAction}\n出力ファイル：${actualTarget}\nタスク完了条件：${t.completionCriteria}\n今日の指示：${pick.action}\n完了時は実施内容、成果物、実行した検証と結果、残る障害を報告する。未実施を完了と述べない。`;
 this.s.set('runReport:'+run.id,actualTarget);this.s.set('runRole:'+run.id,role);this.s.set('runPolicy:'+run.id,rolePolicy(role,base));this.s.set('runCategory:'+run.id,pick.category||'');if(this.connectionForWorker)this.s.set('runScrum:'+run.id,this.connectionForWorker({parentSession,runId:run.id}));this.s.set('runModel:'+run.id,model);
 this.save(a,{runId:run.id,workspace:run.workspace||null,status:'running',instruction,taskVersion:context.taskVersion});await this.pi.prompt(run.id,instruction,id,context);
 }catch(e){this.save(this.list().find(x=>x.id===id),{status:'error',error:e.message});}if(!ulw.active)break;
 }
 }finally{this.busy=false}
 }
}
