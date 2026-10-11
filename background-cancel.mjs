// Cancel only this parent's assignments and its not-yet-dispatched requests.
export async function backgroundCancel(runtime,args,parent){
 const id=args.assignmentId??args.taskId??args.task_id,all=args.all===true;
 if(!all&&(typeof id!=='string'||!id))throw Error('Provide assignmentId/taskId or all=true');
 const s=runtime.s,owned=runtime.list().filter(a=>a.parentSession===parent),active=new Set(['running','preparing','retrying','pending']);
 const queueKey='scrumQueue:'+parent,queue=s.setting(queueKey,[]);
 const targets=all?owned.filter(a=>active.has(a.status)):owned.filter(a=>a.id===id||args.taskId===id&&a.taskId===id&&active.has(a.status));
 const pending=all?queue:queue.filter(p=>p.taskId===id);
 if(!all&&!targets.length&&!pending.length)throw Error('この親の担当ではありません');
 if(targets.some(a=>!active.has(a.status)))throw Error('Only running or pending assignments can be cancelled');
 // Persist cancellation before scheduling can dispatch the removed request.
 if(pending.length)s.set(queueKey,all?[]:queue.filter(p=>p.taskId!==id));
 const base={...(id?{assignmentId:id}:{}),assignmentIds:targets.map(a=>a.id),cancelledPendingTaskIds:pending.map(p=>p.taskId)};
 if(targets.length&&await runtime.reports.isBusy(parent)){
  const key='scrumCancelQueue:'+parent;s.set(key,[...new Set([...s.setting(key,[]),...base.assignmentIds])]);runtime.schedule();return {queued:true,...base};
 }
 for(const a of targets)await runtime.stop(a.id);
 return {cancelled:true,...base};
}
