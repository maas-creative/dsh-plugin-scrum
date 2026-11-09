import {createHash} from 'node:crypto';
import {DeliveryOutbox} from './delivery-outbox.mjs';
const failures=new Set(['error','conflict','uncertain']);
export class ParentReports{
 constructor(store,{list,deliver,isBusy=()=>false,now=Date.now,debounceMs=100,leaseMs=30000}){Object.assign(this,{store,list,deliver,isBusy,now,debounceMs,leaseMs});this.flushing=false;this.outbox=typeof store.run==='function'&&typeof store.get==='function'?new DeliveryOutbox(store):null;}
 enqueue(assignment){
  const dedupeKey=assignment.id+':'+assignment.status+':'+assignment.taskVersion;
  const report={id:createHash('sha256').update(dedupeKey).digest('hex'),parentSession:assignment.parentSession,assignmentId:assignment.id,taskId:assignment.taskId,runId:assignment.runId,role:assignment.role||'executor',status:assignment.status,result:assignment.result||'',error:assignment.error||'',artifact:assignment.artifact?{path:assignment.artifact.path,hash:assignment.artifact.hash}:null,verified:false,state:'pending',attempts:0,created:this.now(),nextAt:this.now()+this.debounceMs};
  if(this.outbox){this.outbox.enqueue({parentSession:assignment.parentSession,kind:'report',dedupeKey,payload:report,nextAt:report.nextAt});this.onPending?.();return}
  const key='scrumReport:'+report.id;if(this.store.setting(key,null))return;
  this.store.set(key,report);this.onPending?.();
 }
 all(){return this.outbox?this.outbox.all().map(row=>({...row.payload,state:row.state,attempts:row.attempts,nextAt:row.nextAt,delivered:row.deliveredAt,lastError:row.lastError})):this.store.all("SELECT value FROM settings WHERE key LIKE 'scrumReport:%'").map(r=>JSON.parse(r.value))}
 async flush(){if(this.flushing||!this.deliver)return;this.flushing=true;try{return this.outbox?await this.flushOutbox():await this.flushLegacy()}finally{this.flushing=false}}
 // Delivery state lives in the outbox, separate from the execution result. A
 // retry re-sends the stored report and never re-runs the worker.
 async flushOutbox(){
  this.outbox.recoverExpiredLeases(this.now());
  const due=this.outbox.due(this.now()),parents=[...new Set(due.map(r=>r.parentSession))];
  for(const parentSession of parents){
   if(await this.isBusy(parentSession))continue;
   const saved=this.store.setting('scrumDelivery:'+parentSession,null);
   let batch;
   if(saved){batch=this.outbox.byIds(saved.reportIds).filter(r=>r.state==='pending');if(!batch.length){this.store.set('scrumDelivery:'+parentSession,null);continue}if(batch.some(r=>r.nextAt>this.now()))continue}
   else{batch=due.filter(r=>r.parentSession===parentSession);if(!batch.length)continue}
   const running=this.list().some(a=>a.parentSession===parentSession&&['preparing','running'].includes(a.status));
   const wake=saved?.wake??(!running||batch.some(r=>failures.has(r.payload.status)));
   const deliveryId=saved?.id||createHash('sha256').update(batch.map(r=>r.deliveryId).sort().join(':')).digest('hex');
   if(!saved)this.store.set('scrumDelivery:'+parentSession,{id:deliveryId,reportIds:batch.map(r=>r.deliveryId),wake});
   const rows=this.outbox.claim(batch.map(r=>r.deliveryId),this.now(),this.leaseMs,deliveryId);
   if(!rows.length)continue;
   // Record the wake intent before delivery. The wake marker itself is written
   // by the delivery callback, which then completes this receipt; a crash
   // leaves it pending so a restart can check the marker instead of waking twice.
   if(wake){this.outbox.beginWake({batchId:deliveryId,parentSession,deliveryIds:rows.map(r=>r.deliveryId)});this.outbox.markWakeRequested(deliveryId)}
   try{
    await this.deliver(parentSession,{id:deliveryId,reports:rows.map(r=>r.payload),wake,allFinished:!running});
    this.outbox.markDelivered(rows,this.now(),wake,deliveryId);
    this.store.set('scrumDelivery:'+parentSession,null);
    // Completing the wake receipt is a separate durable step: a failure here
    // must not revert an already delivered outbox row to pending.
    if(wake){try{this.outbox.completeWake(deliveryId)}catch(error){this.outbox.noteWakeError(deliveryId,error.message)}}
   }catch(error){this.outbox.markRetry(rows,this.now(),error.message);if(wake)this.outbox.failWake(deliveryId,error.message)}
  }
 }
 async flushLegacy(){
  const pending=this.all().filter(r=>r.state==='pending'&&r.nextAt<=this.now()),parents=new Set(pending.map(r=>r.parentSession));
  for(const parentSession of parents){
   if(await this.isBusy(parentSession))continue;
   const saved=this.store.setting('scrumDelivery:'+parentSession,null);
   const batch=saved?this.all().filter(r=>saved.reportIds.includes(r.id)&&r.state==='pending'):pending.filter(r=>r.parentSession===parentSession),running=this.list().some(a=>a.parentSession===parentSession&&['preparing','running'].includes(a.status));
   if(saved&&!batch.length){this.store.set('scrumDelivery:'+parentSession,null);continue}
   if(saved&&batch.some(r=>r.nextAt>this.now()))continue;
   const wake=saved?.wake??(!running||batch.some(r=>failures.has(r.status)));
   const deliveryId=saved?.id||createHash('sha256').update(batch.map(r=>r.id).sort().join(':')).digest('hex');
   if(!saved)this.store.set('scrumDelivery:'+parentSession,{id:deliveryId,reportIds:batch.map(r=>r.id),wake});
   try{
    await this.deliver(parentSession,{id:deliveryId,reports:batch,wake,allFinished:!running});
    for(const report of batch)this.store.set('scrumReport:'+report.id,{...report,state:'delivered',delivered:this.now(),wake});
    this.store.set('scrumDelivery:'+parentSession,null);
   }catch(error){
    for(const report of batch){const attempts=report.attempts+1;this.store.set('scrumReport:'+report.id,{...report,attempts,lastError:error.message,nextAt:this.now()+Math.min(60000,1000*2**Math.min(attempts,6))})}
   }
  }
 }
}
