import test from 'node:test';
import assert from 'node:assert/strict';
import {BasicCompactionEngine} from '@deepseek-ai/dsh-compaction-basic';
import ScrumCompactionEngine from './compaction-hooks.mjs';
import {compactionState} from './compaction-state.mjs';
test('GLM summary reserves the declared model output limit without overriding explicit policy',()=>{
 const glm={provider:'local-glm',model:'glm53-fast'},config={auto:false,thresholdRatio:.8},ctx={reflect:{provide(){}}};
 const defaulted=new ScrumCompactionEngine(ctx,config);assert.equal(defaulted.config.modelPolicies.find(p=>p.provider===glm.provider&&p.model===glm.model).maxTokens,8192);
 const custom=new ScrumCompactionEngine(ctx,{...config,modelPolicies:[{...glm,maxTokens:4096}]});assert.equal(custom.config.modelPolicies[0].maxTokens,4096);
 const global=new ScrumCompactionEngine(ctx,{...config,maxTokens:2048});assert.equal(global.config.maxTokens,2048);assert.equal(global.config.modelPolicies.length,0);
});
test('failed compaction releases continuation guard and next compaction succeeds',async()=>{
 const original=BasicCompactionEngine.prototype.summarize;
 const engine=Object.create(ScrumCompactionEngine.prototype);engine.ctx={};engine.triggers=new WeakMap();
 const agent={session:{id:'compaction-failure-fixture',header:{cwd:process.cwd()}}},failure=Error('provider failed during summary');
 try{
  BasicCompactionEngine.prototype.summarize=async()=>{assert.equal(compactionState(agent).active,true);throw failure};
  await assert.rejects(engine.summarize({messages:[]},agent,new AbortController().signal),error=>error===failure);
  assert.equal(compactionState(agent).active,false);assert.equal(compactionState(agent).acknowledgedEpoch,1);
  BasicCompactionEngine.prototype.summarize=async()=>({summary:'recovered'});
  assert.deepEqual(await engine.summarize({messages:[]},agent,new AbortController().signal),{summary:'recovered'});
  assert.equal(compactionState(agent).active,false);assert.equal(compactionState(agent).acknowledgedEpoch,2);
 }finally{BasicCompactionEngine.prototype.summarize=original}
});
test('compaction passes repeated dashboard snapshots as reconstructable deltas',async()=>{
 const original=BasicCompactionEngine.prototype.summarize,engine=Object.create(ScrumCompactionEngine.prototype);engine.ctx={};engine.triggers=new WeakMap();const agent={session:{id:'ledger-delta-fixture',header:{cwd:process.cwd()}}},ledger={tasks:[{id:'t',body:'x'.repeat(2000)}],projects:[{id:'p'}]};const snapshot=(now,notes)=>({role:'user',source:{kind:'agent-message'},content:[{type:'text',text:JSON.stringify({now,documents:[],ledger:{...ledger,notes}})}]});
 try{BasicCompactionEngine.prototype.summarize=async input=>{assert.match(input.messages[1].content[0].text,/__dashboard_ledger_delta_v1/);return {summary:'ok'}};await engine.summarize({messages:[snapshot('first',['a']),snapshot('second',['b'])]},agent,new AbortController().signal)}finally{BasicCompactionEngine.prototype.summarize=original}
});

test('only warm pressure can defer once; overflow remains immediate',async()=>{
 const original=BasicCompactionEngine.prototype.compactIfNeeded,calls=[];const engine=Object.create(ScrumCompactionEngine.prototype),controller=new AbortController();
 engine.ctx={llm:{resolveModelInfo:async()=>({context:{contextWindow:262144},defaultMaxTokens:8192})},tokenMeter:{measure:()=>({totalTokens:190000})}};engine.config={thresholdRatio:.8,headroomTokens:65536,modelPolicies:[]};engine.triggers=new WeakMap();engine.pressureInFlight=new WeakSet();engine.lastPressure=new WeakMap();engine.cacheDeferred=new WeakSet();
 const call=(total,input,cached)=>({type:'assistant/message',data:{usage:{totalTokens:total+10,outputTokens:10,inputTokens:input,cacheReadTokens:cached}}});const agent={session:{header:{cwd:process.cwd()},requestHeader:()=>({config:{provider:'local-glm',model:'glm53-fast',maxTokens:8192}}),snapshotEvents:()=>[{type:'request/header'},call(180000,8000,172000),call(188000,9000,179000)]}};
 try{BasicCompactionEngine.prototype.compactIfNeeded=async(_agent,trigger)=>{calls.push(trigger);return {compacted:true}};assert.equal(await engine.compactIfNeeded(agent,'pressure',controller.signal),null);assert.deepEqual(calls,[]);assert.deepEqual(await engine.compactIfNeeded(agent,'pressure',controller.signal),{compacted:true});assert.deepEqual(calls,['pressure']);assert.deepEqual(await engine.compactIfNeeded(agent,'context-overflow',controller.signal),{compacted:true});assert.deepEqual(calls,['pressure','context-overflow'])}finally{BasicCompactionEngine.prototype.compactIfNeeded=original}
});

test('large GLM history is compacted in bounded, tool-balanced regions while retaining the tail',async()=>{
 const engine=Object.create(ScrumCompactionEngine.prototype),events=new Map([
  [1,{seq:1,type:'system/message'}],[2,{seq:2,type:'user/message'}],
  [3,{seq:3,type:'assistant/message',data:{message:{content:[{type:'tool-call'}]}}}],
  [4,{seq:4,type:'tool/result'}],[5,{seq:5,type:'user/message'}],
  [6,{seq:6,type:'user/message',data:{content:[{type:'text',text:'未処理の本人指示'}]}}]
 ]),sizes=new Map([[1,1000],[2,40000],[3,25000],[4,5000],[5,40000],[6,40000]]);
 const session={surface:{nodes:[1,2,3,4,5,6],replaceGeneration:0},eventAt:n=>events.get(n),requestHeader:()=>({config:{provider:'local-glm',model:'glm53-fast',maxTokens:4096}})};
 const agent={session},regions=[];engine.config={thresholdRatio:.8,headroomTokens:8192};
 engine.ctx={llm:{resolveModelInfo:async()=>({context:{contextWindow:200000},defaultMaxTokens:4096})},tokenMeter:{measure:()=>({nodes:session.surface.nodes.map(seq=>({seq,tokens:sizes.get(seq)})),totalTokens:session.surface.nodes.reduce((sum,seq)=>sum+sizes.get(seq),0)})}};
 engine.compactRegion=async(start,end)=>{regions.push([start,end]);const a=session.surface.nodes.indexOf(start),b=session.surface.nodes.indexOf(end),seq=100+regions.length;events.set(seq,{seq,type:'user/message'});sizes.set(seq,1000);session.surface.nodes.splice(a,b-a+1,seq);session.surface.replaceGeneration++;return {ok:true}};
 let progress=0;const result=await engine.compactWithBoundedInput(agent,'pressure',new AbortController().signal,()=>progress++);
 assert.equal(result.ok,true);assert.equal(progress,regions.length);assert.deepEqual(regions[0],[2,4]);assert(session.surface.nodes.includes(6));assert.equal(session.eventAt(6).data.content[0].text,'未処理の本人指示');assert(!regions.some(([,end])=>end===3));
});
test('a rejected oversized summary is retried with a smaller region without dropping the tail',async()=>{
 const engine=Object.create(ScrumCompactionEngine.prototype),events=new Map(),sizes=new Map(),nodes=[1,2,3,4,5,6];for(const n of nodes){events.set(n,{seq:n,type:n===1?'system/message':'user/message',data:{content:[]}});sizes.set(n,n===1?1000:n===6?150000:15000)}
 const session={surface:{nodes,replaceGeneration:0},eventAt:n=>events.get(n),requestHeader:()=>({config:{provider:'local-glm',model:'glm53-fast',maxTokens:4096}})},agent={session},regions=[];
 engine.config={thresholdRatio:.8,headroomTokens:8192};engine.ctx={llm:{resolveModelInfo:async()=>({context:{contextWindow:200000},defaultMaxTokens:4096})},tokenMeter:{measure:()=>({nodes:session.surface.nodes.map(seq=>({seq,tokens:sizes.get(seq)})),totalTokens:session.surface.nodes.reduce((sum,seq)=>sum+sizes.get(seq),0)})}};
 engine.compactRegion=async(start,end)=>{regions.push([start,end]);if(regions.length===1)throw Object.assign(Error('too long'),{code:'CONTEXT_WINDOW_EXCEEDED'});const a=session.surface.nodes.indexOf(start),b=session.surface.nodes.indexOf(end),seq=100+regions.length;events.set(seq,{seq,type:'user/message'});sizes.set(seq,1000);session.surface.nodes.splice(a,b-a+1,seq);session.surface.replaceGeneration++;return {ok:true}};
 await engine.compactWithBoundedInput(agent,'context-overflow',new AbortController().signal);assert.deepEqual(regions.slice(0,2),[[2,5],[2,3]]);assert(session.surface.nodes.includes(6));
});
test('bounded selection prices repeated snapshots after delta conversion',async()=>{
 const engine=Object.create(ScrumCompactionEngine.prototype),events=new Map(),sizes=new Map(),nodes=[1];events.set(1,{seq:1,type:'system/message'});sizes.set(1,1000);for(let seq=2;seq<=11;seq++){nodes.push(seq);events.set(seq,{seq,type:'user/message',data:{role:'user',source:{kind:'agent-message'},content:[{type:'text',text:JSON.stringify({now:String(seq),documents:[],ledger:{tasks:[{body:'x'.repeat(15000)}],projects:[],revision:seq}})}]}});sizes.set(seq,20000)}nodes.push(12);events.set(12,{seq:12,type:'user/message',data:{role:'user',source:{kind:'user'},content:[{type:'text',text:'未処理の指示'}]}});sizes.set(12,1000);
 const session={surface:{nodes,replaceGeneration:0},eventAt:n=>events.get(n),deriveEventMessage:e=>e?.data,requestHeader:()=>({config:{provider:'local-glm',model:'glm53-fast',maxTokens:4096}})},agent={session},regions=[];engine.config={thresholdRatio:.8,headroomTokens:8192};engine.ctx={llm:{resolveModelInfo:async()=>({context:{contextWindow:200000},defaultMaxTokens:4096})},tokenMeter:{estimateMessage:m=>m.content[0].text.length,measure:()=>({nodes:session.surface.nodes.map(seq=>({seq,tokens:sizes.get(seq)})),totalTokens:session.surface.nodes.reduce((sum,seq)=>sum+sizes.get(seq),0)})}};
 engine.compactRegion=async(start,end)=>{regions.push([start,end]);const a=nodes.indexOf(start),b=nodes.indexOf(end),seq=100;events.set(seq,{seq,type:'user/message',data:{role:'user',content:[{type:'text',text:'summary'}]}});sizes.set(seq,100);nodes.splice(a,b-a+1,seq);session.surface.replaceGeneration++;return {ok:true}};
 await engine.compactWithBoundedInput(agent,'pressure',new AbortController().signal);assert.deepEqual(regions,[[2,11]]);assert.equal(session.eventAt(12).data.content[0].text,'未処理の指示');
});
