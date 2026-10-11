import {createHash} from 'node:crypto';
const failures=new Set(['error','conflict','uncertain']);
export class ParentReports{
 constructor(store,{list,deliver,isBusy=()=>false,now=Date.now,debounceMs=100}){Object.assign(this,{store,list,deliver,isBusy,now,debounceMs});this.flushing=false;}
 enqueue(assignment){
  const id=createHash('sha256').update(assignment.id+':'+assignment.status+':'+assignment.taskVersion).digest('hex'),key='scrumReport:'+id;
  if(this.store.setting(key,null))return;
  this.store.set(key,{id,parentSession:assignment.parentSession,assignmentId:assignment.id,taskId:assignment.taskId,runId:assignment.runId,role:assignment.role||'executor',status:assignment.status,result:assignment.result||'',error:assignment.error||'',artifact:assignment.artifact?{path:assignment.artifact.path,hash:assignment.artifact.hash}:null,verified:false,state:'pending',attempts:0,created:this.now(),nextAt:this.now()+this.debounceMs});this.onPending?.();
 }
 all(){return this.store.all("SELECT value FROM settings WHERE key LIKE 'scrumReport:%'").map(r=>JSON.parse(r.value))}
 async flush(){
  if(this.flushing||!this.deliver)return;this.flushing=true;
  try{
   const pending=this.all().filter(r=>r.state==='pending'&&r.nextAt<=this.now()),parents=new Set(pending.map(r=>r.parentSession));
   for(const parentSession of parents){
    if(await this.isBusy(parentSession))continue;
    const saved=this.store.setting('scrumDelivery:'+parentSession,null);
    const batch=saved?this.all().filter(r=>saved.reportIds.includes(r.id)):pending.filter(r=>r.parentSession===parentSession),running=this.list().some(a=>a.parentSession===parentSession&&['preparing','running'].includes(a.status));
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
  }finally{this.flushing=false}
 }
}
