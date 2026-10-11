const alive=pid=>{try{process.kill(pid,0);return true}catch(error){if(error.code==='ESRCH')return false;return true}};
export const recordDagHost=(runtime,runId)=>runtime.s.set('scrumDagHost:'+runId,{pid:process.pid,recordedAt:Date.now()});
// A live/reused PID or a missing receipt is uncertain. Never take another host's run.
export function pauseCrashedDagRuns(runtime,store,manager,parent,{isAlive=alive,now=Date.now}={}){
 const paused=[],unconfirmed=[];
 for(const observed of manager.list(parent)){
  if(!['pending','running'].includes(observed.status))continue;
  const owner=runtime.s.setting('scrumDagHost:'+observed.runId,null);
  if(!Number.isSafeInteger(owner?.pid)||owner.pid<=0||isAlive(owner.pid)){unconfirmed.push(observed.runId);continue}
  store.withRunLock(observed.runId,()=>{
   const fresh=store.readCheckpoint(observed.runId),current=runtime.s.setting('scrumDagHost:'+observed.runId,null);
   if(fresh?.parentSessionId!==parent||!['pending','running'].includes(fresh.status)||current?.pid!==owner.pid||isAlive(owner.pid))return;
   const at=new Date(now()).toISOString(),seq=Math.max(fresh.checkpointSeq||0,store.readEvents(observed.runId,0,{limit:1}).headSeq)+1;
   store.appendEvent({type:'dag.run.paused',reason:'confirmed_host_crash',schemaVersion:1,runId:observed.runId,seq,at,lane:'boundary'});
   const {leaseHolderPid:_lease,_scrumLease:_schedulerLease,...released}=fresh;store.writeCheckpoint(observed.runId,{...released,status:'paused',previousLeaseHolderPid:owner.pid,checkpointSeq:seq,updatedAt:at});paused.push(observed.runId);
  });
 }return {paused,unconfirmed};
}
