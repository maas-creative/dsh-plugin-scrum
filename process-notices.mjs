import {createUserMessage} from '@deepseek-ai/dsh-llm';import {recordParentNotice} from './native-notification.mjs';
// Reservations survive host crashes in the same native session log. A notice is
// acknowledged only after its message appears in the durable conversation.
export class ProcessNotices{
 constructor(ctx){this.ctx=ctx;this.work=new Map();this.liveSent=new WeakMap()}
 pending(agent){const reservations=new Map(),acked=new Set();for(const event of agent.session.snapshotEvents()){if(event.type==='scrum/process-notice')reservations.set(event.data.id,event.data);if(event.type==='scrum/process-notice-ack')acked.add(event.data.id)}return [...reservations.values()].filter(event=>!acked.has(event.id))}
 async enqueue(agent,result){
  if(this.closed||agent.status==='disposed')return;const id='process:'+result.id+':'+(result.batchSeq??'complete'),data={id,mode:result.mode||'live_safe',message:JSON.stringify(result),createdAt:Date.now()};
  if(agent.session.snapshotEvents().some(event=>event.type==='scrum/process-notice'&&event.data.id===id))return this.drain(agent);
  if(Buffer.byteLength(data.message)>180000)data.message=JSON.stringify({...result,records:[],lines:[],outputNoticeTruncated:true,instruction:'Use command_monitor_output or terminal_output for retained output'});
  const pending=this.pending(agent);let bytes=pending.reduce((sum,notice)=>sum+Buffer.byteLength(notice.message),0),dropped=0;for(const notice of pending){if(bytes+Buffer.byteLength(data.message)<=200000)break;bytes-=Buffer.byteLength(notice.message);agent.session.append('scrum/process-notice-ack',{id:notice.id,status:'dropped',reason:'Pending notification byte budget',at:Date.now()});this.liveSent.get(agent)?.delete(notice.id);dropped++}if(dropped)data.message=JSON.stringify({droppedPriorNotices:dropped,payload:JSON.parse(data.message)});
  if(!agent.session.snapshotEvents().some(event=>event.type==='scrum/process-notice'&&event.data.id===id)){agent.session.append('scrum/process-notice',data);await this.ctx.sessions.flush(agent.session)}
  return this.drain(agent);
 }
 drain(agent){if(this.closed)return Promise.resolve();const previous=this.work.get(agent)||Promise.resolve(),job=previous.catch(()=>{}).then(async()=>{
  let sent=this.liveSent.get(agent);if(!sent)this.liveSent.set(agent,sent=new Set());
  for(const notice of this.pending(agent)){
   if(this.closed)return;
   const marker='Scrum notification '+notice.id+'\n',text=m=>typeof m.content==='string'?m.content:(m.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n');
   const delivered=agent.session.deriveMessages().some(m=>text(m).startsWith(marker));
   if(delivered){agent.session.append('scrum/process-notice-ack',{id:notice.id,acknowledgedAt:Date.now()});await this.ctx.sessions.flush(agent.session);sent.delete(notice.id);continue}
   if(agent.status==='running'){
    if(notice.mode==='live_safe'&&!sent.has(notice.id)&&![...agent.inbox.nextStep,...agent.inbox.nextTurn].some(m=>text(m).startsWith(marker))){agent.send(createUserMessage({content:[{type:'text',text:'Scrum notification '+notice.id+'\n'+notice.message}],source:{kind:'subagent-settled',form:'notice',summary:'Owned process output',senderSessionId:agent.session.id}}),'next-step',false);sent.add(notice.id)}
    continue;
   }
   if(agent.status==='disposed')return;
   await recordParentNotice(this.ctx,agent,{notificationId:notice.id,senderSessionId:agent.session.id,message:notice.message},createUserMessage);
   agent.session.append('scrum/process-notice-ack',{id:notice.id,acknowledgedAt:Date.now()});await this.ctx.sessions.flush(agent.session);sent.delete(notice.id);
  }
 }).finally(()=>{if(this.work.get(agent)===job)this.work.delete(agent)});this.work.set(agent,job);return job;}
 async close(){this.closed=true;await Promise.allSettled([...this.work.values()])}
}
