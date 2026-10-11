import test from 'node:test';import assert from 'node:assert/strict';import {MemoryNotices} from './memory-notices.mjs';
function fixture(){const events=[{type:'user/message',seq:1,data:{id:'human',source:{kind:'user'},content:'exports'}}],sent=[];const agent={status:'running',inbox:{nextStep:[],nextTurn:[]},session:{id:'parent',snapshotEvents:()=>events,append:(type,data)=>events.push({type,data})},send:m=>{sent.push(m);agent.inbox.nextStep.push(m)}};const ctx={sessions:{flush:async()=>{}}};return {events,sent,agent,ctx};}
const payload={queryId:'human',revision:'git',nudges:[{path:'reference/exports.md',hint:'The note records that exports retain receipts.'}]};
test('running memory notice acknowledges durable reception, never inbox acceptance, and repairs crash before ack',async()=>{
 const f=fixture(),n=new MemoryNotices(f.ctx);await n.enqueue(f.agent,payload);assert.equal(f.sent.length,1);assert.equal(n.pending(f.agent).length,1);assert.equal(f.events.filter(e=>e.type==='scrum/memory-surfaced').length,0);await n.drain(f.agent);assert.equal(f.sent.length,1);
 // Delivery reached the persistent conversation, but the process died before acknowledgement.
 f.events.push({type:'user/message',data:f.sent[0]});f.agent.inbox.nextStep=[];const restarted=new MemoryNotices(f.ctx);await restarted.drain(f.agent);assert.equal(restarted.pending(f.agent).length,0);assert.equal(f.events.filter(e=>e.type==='scrum/memory-surfaced').length,1);await restarted.drain(f.agent);assert.equal(f.events.filter(e=>e.type==='scrum/memory-surfaced').length,1);assert.equal(f.sent.length,1);
});
test('pending notice recovers after restart, but a new human request supersedes undelivered memory',async()=>{
 const f=fixture(),n=new MemoryNotices(f.ctx);await n.enqueue(f.agent,payload);f.agent.inbox.nextStep=[];f.agent.status='idle';await new MemoryNotices(f.ctx).drain(f.agent);assert.equal(f.events.filter(e=>e.type==='user/message').length,2);
 const g=fixture(),other=new MemoryNotices(g.ctx);await other.enqueue(g.agent,payload);g.agent.inbox.nextStep=[];g.events.push({type:'user/message',data:{id:'next',source:{kind:'user'},content:'other'}});await new MemoryNotices(g.ctx).drain(g.agent);assert.equal(g.events.at(-1).data.status,'superseded');assert.equal(g.events.filter(e=>e.type==='scrum/memory-surfaced').length,0);
});
