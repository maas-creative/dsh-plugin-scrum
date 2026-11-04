import {appendScrumEvent,scrumEventType} from './scrum-events.mjs';
import {createHash} from 'node:crypto';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {renderNudgeBlock} from './independent/memory-text.mjs';
const text=m=>typeof m?.content==='string'?m.content:(m?.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
export class MemoryNotices {
 constructor(ctx){this.ctx=ctx;this.work=new Map();this.closed=false;}
 pending(agent){const reservations=new Map(),acked=new Set();for(const e of agent.session.snapshotEvents()){if(scrumEventType(e.type)==='scrum/memory-notice')reservations.set(e.data.id,e.data);if(scrumEventType(e.type)==='scrum/memory-notice-ack')acked.add(e.data.id)}return [...reservations.values()].filter(n=>!acked.has(n.id));}
 async enqueue(agent,{queryId,revision,nudges}){
  if(this.closed||agent.status==='disposed'||!nudges.length)return;
  const id=createHash('sha256').update(JSON.stringify({parent:agent.session.id,queryId,revision,nudges})).digest('hex'),body=nudges.map(renderNudgeBlock).join('\n\n');
  if(Buffer.byteLength(body)>16000)throw Error('Memory notice exceeds byte budget');
  if(!agent.session.snapshotEvents().some(e=>scrumEventType(e.type)==='scrum/memory-notice'&&e.data.id===id)){appendScrumEvent(agent.session,'scrum/memory-notice',{id,queryId,revision,paths:nudges.map(n=>n.path),body});await this.ctx.sessions.flush(agent.session);}
  return this.drain(agent);
 }
 drain(agent){const prior=this.work.get(agent)||Promise.resolve(),job=prior.catch(()=>{}).then(async()=>{
  if(this.closed||agent.status==='disposed')return;
  for(const notice of this.pending(agent)){
   const events=agent.session.snapshotEvents(),marker='Scrum memory '+notice.id+'\n';
   const received=events.some(e=>e.type==='user/message'&&text(e.data).startsWith(marker));
   if(received){await this.ctx.sessions.flush(agent.session);if(!agent.session.snapshotEvents().some(e=>scrumEventType(e.type)==='scrum/memory-surfaced'&&e.data.noticeId===notice.id))appendScrumEvent(agent.session,'scrum/memory-surfaced',{noticeId:notice.id,paths:notice.paths});appendScrumEvent(agent.session,'scrum/memory-notice-ack',{id:notice.id,status:'received'});await this.ctx.sessions.flush(agent.session);continue;}
   const human=events.filter(e=>e.type==='user/message'&&e.data.source?.kind==='user').at(-1),queryId=human?.data.id||String(human?.seq);
   if(queryId!==notice.queryId){appendScrumEvent(agent.session,'scrum/memory-notice-ack',{id:notice.id,status:'superseded'});await this.ctx.sessions.flush(agent.session);continue;}
   const inbox=[...(agent.inbox?.nextStep||[]),...(agent.inbox?.nextTurn||[])];if(inbox.some(m=>text(m).startsWith(marker)))continue;
   const message=createUserMessage({content:[{type:'text',text:marker+notice.body}],source:{kind:'agent-message',form:'relay',senderSessionId:agent.session.id}});
   if(agent.status==='running')agent.send(message,'next-step',false);
   else {agent.session.append('user/message',message,{surfaceOp:'append'});await this.ctx.sessions.flush(agent.session);if(!agent.session.snapshotEvents().some(e=>scrumEventType(e.type)==='scrum/memory-surfaced'&&e.data.noticeId===notice.id))appendScrumEvent(agent.session,'scrum/memory-surfaced',{noticeId:notice.id,paths:notice.paths});appendScrumEvent(agent.session,'scrum/memory-notice-ack',{id:notice.id,status:'received'});await this.ctx.sessions.flush(agent.session);}
  }
 }).finally(()=>{if(this.work.get(agent)===job)this.work.delete(agent)});this.work.set(agent,job);return job;}
 async close(){this.closed=true;await Promise.allSettled([...this.work.values()]);}
}
