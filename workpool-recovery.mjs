const alive=pid=>{try{process.kill(pid,0);return true}catch(error){return error.code!=='ESRCH'}};
// Lost native hosts cannot prove a send was unexecuted. Keep keyed receipts and
// retire their child identity; only a new explicit key may create fresh work.
export function recoverWorkpoolWorkers(runtime,pools,tasks,{isAlive=alive}={}){
 const recovered=[],unconfirmed=[],records=tasks.list();
 const retireThread=(record,parent)=>{const thread=runtime.threads?.list(parent).find(t=>t.sessionId===record.child_session_id);if(thread&&thread.status!=='interrupted')runtime.threads.save({...thread,status:'interrupted',retiredReason:'workpool-host-ended'})};
 for(const pool of pools.list()){
  const ids=new Set([...pool.workers.map(w=>w.task_id),...pool.items.flatMap(i=>i.binding?[i.binding.task_id]:[]),...records.filter(t=>t.pool_id===pool.pool_id).map(t=>t.task_id)]);
  const retire=new Set();
  for(const id of ids){
   const record=tasks.load(id);if(!record||record.parent_session_id!==pool.parent_session_id)continue;
   if(record.hostCrashed){retireThread(record,pool.parent_session_id);retire.add(id);continue}
   if(!['pending','running','error','cancelled','interrupted','lost'].includes(record.status)&&!(record.hostReleased&&record.cleanupComplete))continue;
   const released=record.hostReleased===true&&record.cleanupComplete===true;
   if(!released&&(!Number.isSafeInteger(record.host_pid)||record.host_pid<1||isAlive(record.host_pid))){unconfirmed.push(id);continue}
   const next=tasks.mutate(id,current=>{
    if(current.host_pid!==record.host_pid||current.notification.run_epoch!==record.notification.run_epoch)return current;
    if(!released&&isAlive(current.host_pid))return current;
    return {...current,status:'lost',hostCrashed:true,cleanupComplete:true,cleanupError:null,recoveryReason:released?'owned_host_closed':'confirmed_host_crash',error:'Native worker host ended; inspect preserved output and use a new explicit key. No old key is redispatched.'};
   });
   if(!next?.hostCrashed)continue;
   retire.add(id);recovered.push(id);
   retireThread(record,pool.parent_session_id);
  }
  if(pool.workers.some(w=>retire.has(w.task_id)))pools.mutate(pool.pool_id,current=>({...current,workers:current.workers.filter(w=>!retire.has(w.task_id))}));
 }return {recovered,unconfirmed};
}
