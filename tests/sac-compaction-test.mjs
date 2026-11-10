import test from 'node:test';
import assert from 'node:assert/strict';
import ScrumCompactionEngine from "../compaction-hooks.mjs";

test('non-main SAC compacts after a completed step and persists semantic state',async()=>{
 const events=[
  {seq:1,type:'system/message',data:{}},
  {seq:2,type:'user/message',data:{message:{content:[{type:'text',text:'Inspect the task'}]}}},
  {seq:3,type:'assistant/message',data:{message:{content:[{type:'text',text:'I inspected it'}]}}},
  {seq:4,type:'step/end',data:{step:0}},
 ];
 const eventMap=new Map(events.map(event=>[event.seq,event]));
 const session={id:'sac-fixture',header:{cwd:process.cwd()},surface:{nodes:[1,2,3],replaceGeneration:0},eventAt:seq=>eventMap.get(seq),snapshotEvents:()=>events,append:(type,data)=>{const event={seq:events.length+1,type,data};events.push(event);eventMap.set(event.seq,event);return event.seq}};
 const agent={session};
 const engine=Object.create(ScrumCompactionEngine.prototype);
 engine.ctx={tokenMeter:{measure:()=>({nodes:session.surface.nodes.map(seq=>({seq,tokens:seq===1?1000:5000})),totalTokens:session.surface.nodes.reduce((sum,seq)=>sum+(seq===1?1000:5000),0)})}};
 engine.sacNonMain=true;engine.sacMinTokens=1;engine.sacInFlight=new WeakSet();engine.triggers=new WeakMap();engine.semanticTracker={flush:async()=>{}};
 const ranges=[];
 engine.compactRegion=async(start,end)=>{
  ranges.push([start,end]);
  const replacement=events.length+10;
  eventMap.set(replacement,{seq:replacement,type:'user/message',data:{message:{source:{kind:'compact-checkpoint'},content:[{type:'text',text:'state'}]}}});
  events.push({seq:replacement-1,type:'compaction/summary',data:{}});
  events.push(eventMap.get(replacement));
  events.push({seq:replacement+1,type:'compaction/end',data:{}});
  const startIndex=session.surface.nodes.indexOf(start),endIndex=session.surface.nodes.indexOf(end);
  session.surface.nodes.splice(startIndex,endIndex-startIndex+1,replacement);session.surface.replaceGeneration++;
  return {summarySeq:replacement-1,endSeq:replacement+1};
 };
 const result=await engine.compactIfNeeded(agent,'pressure',new AbortController().signal);
 assert.ok(result);
 assert.deepEqual(ranges,[[2,3]]);
 assert.equal(session.surface.nodes.length,2);
 assert.ok(events.some(event=>event.type==='scrum/semantic-state'||event.type==='plugin:dsh-plugin-scrum/scrum/semantic-state'));
 assert.ok(events.some(event=>event.type==='scrum/sac-boundary'||event.type==='plugin:dsh-plugin-scrum/scrum/sac-boundary'));
});
