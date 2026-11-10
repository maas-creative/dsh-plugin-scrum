import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeExecution} from "../native-runtime.mjs";

test('worker timing is tied to the committed call and missing cache counts remain unknown',async()=>{
 const hooks=new Map(),settings={},events=[{type:'assistant/message',seq:5,data:{usage:{inputTokens:20,outputTokens:4}}}];
 const ctx={on:(name,fn)=>{if(!hooks.has(name))hooks.set(name,[]);hooks.get(name).push(fn)},sessionPersistence:{open:async()=>({read:async()=>({events}),close:async()=>{}})},agents:{},tools:{}};
 const store={get:()=>({id:'worker'}),setting:(key,fallback)=>settings[key]??fallback,set:(key,value)=>settings[key]=value};
 const {pi}=nativeExecution(ctx,store),agent={session:{id:'worker'}};pi.sessions.set('worker',{});
 const emit=frame=>hooks.get('agent/assistant-stream')[0]({agent,frame});
 emit({type:'start',attemptId:'a'});emit({type:'chunk',attemptId:'a',chunk:{type:'block-start'}});emit({type:'chunk',attemptId:'a',chunk:{type:'reasoning-delta',text:'x'}});emit({type:'end',attemptId:'a',outcome:{kind:'committed',eventType:'assistant/message',seq:5}});
 const result=await pi.readUsage('worker');assert.equal(result.lastCall.inputTokens,20);assert.equal(result.lastCall.cacheReadTokens,null);assert.equal(result.lastCall.cacheWriteTokens,null);assert.equal(result.totalUsage.inputTokens,20);assert.equal(result.totalUsage.cacheReadTokens,null);assert(result.firstTokenMs>=0);
 events.unshift({type:'assistant/message',seq:1,data:{usage:{inputTokens:999,outputTokens:999}}},{type:'session/end-seed',seq:2,data:{}});assert.equal((await pi.readUsage('worker')).totalUsage.inputTokens,20);
 events.push({type:'assistant/attempt',seq:7,data:{}});assert.equal((await pi.readUsage('worker')).totalUsage.inputTokens,null);
 events.push({type:'compaction/start',seq:8,time:1000,data:{compactionId:'c'}},{type:'compaction/end',seq:9,time:1250,data:{compactionId:'c'}});assert.equal((await pi.readUsage('worker')).compactionMs,250);
 events.push({type:'assistant/message',seq:6,data:{usage:{inputTokens:1,outputTokens:1}}});assert.equal((await pi.readUsage('worker')).firstTokenMs,null);
});

test('context measurement uses persisted session after worker release',async()=>{
 const {Session}=await import('@deepseek-ai/dsh-session');const session=Session.create('worker'),events=session.snapshotEvents(),settings={'runModel:worker':{provider:'local-glm',model:'glm53-fast'}};let measured=false;
 const store={get:()=>({id:'worker'}),setting:(key,fallback)=>settings[key]??fallback,set:(key,value)=>settings[key]=value};
 const ctx={on:()=>{},sessions:{messageProjections:[]},sessionPersistence:{open:async()=>({read:async()=>({events,header:session.header}),close:async()=>{}})},agents:{},tools:{},llm:{resolveModelInfo:async()=>({context:{contextWindow:262144}})},get:name=>name==='tokenMeter'?{measure:s=>{measured=typeof s.snapshotEvents==='function';return {totalTokens:123,baseline:{kind:'usage'}}}}:null};
 const stats=await nativeExecution(ctx,store).pi.readUsage('worker');assert.equal(measured,true);assert.deepEqual(stats.contextUsage,{tokens:123,basis:'usage'});assert.equal(stats.contextWindow,262144);
});

test('released fork restores persisted header and inherited boundary before measuring context',async()=>{
 const {Session}=await import('@deepseek-ai/dsh-session');
 const header={version:4,id:'worker',createdAt:Date.now(),isSeeded:true,cwd:'/tmp'};
 const parent=Session.create('parent',[]),original=Session.create('worker',parent.snapshotEvents(),header,1),events=original.snapshotEvents(),settings={'runModel:worker':{provider:'local-glm',model:'glm53-fast'}};let seen;
 const store={get:()=>({id:'worker'}),setting:(key,fallback)=>settings[key]??fallback,set:(key,value)=>settings[key]=value};
 const ctx={on:()=>{},sessions:{messageProjections:[]},sessionPersistence:{open:async()=>({header:original.header,inheritedEventCount:1,read:async()=>({events}),close:async()=>{}})},agents:{},tools:{},llm:{resolveModelInfo:async()=>({context:{contextWindow:262144}})},get:name=>name==='tokenMeter'?{measure:s=>{seen=s;return {totalTokens:123,baseline:{kind:'usage'}}}}:null};
 const stats=await nativeExecution(ctx,store).pi.readUsage('worker');assert.equal(seen?.header.isSeeded,true);assert.equal(seen?.header.cwd,'/tmp');assert.equal(seen?.inheritedEventCount,1);assert.deepEqual(stats.contextUsage,{tokens:123,basis:'usage'});
});

test('released fork displays both inherited and own messages',async()=>{
 const {Session}=await import('@deepseek-ai/dsh-session');const {createUserMessage}=await import('@deepseek-ai/dsh-llm');
 const parent=Session.create('parent',[]);parent.append('user/message',createUserMessage({content:[{type:'text',text:'inherited instruction'}],source:{kind:'user'}}),{surfaceOp:'append'});
 const seed=parent.snapshotEvents(),header={version:4,id:'worker',createdAt:Date.now(),isSeeded:true,cwd:'/tmp'};
 const original=Session.create('worker',seed,header,seed.length);original.append('user/message',createUserMessage({content:[{type:'text',text:'own instruction'}],source:{kind:'user'}}),{surfaceOp:'append'});
 const store={get:()=>({id:'worker'}),setting:(_key,fallback)=>fallback,set:()=>{}};
 const ctx={on:()=>{},sessions:{messageProjections:[]},sessionPersistence:{open:async()=>({header:original.header,inheritedEventCount:seed.length,read:async()=>({events:original.snapshotEvents()}),close:async()=>{}})},agents:{},tools:{}};
 const messages=await nativeExecution(ctx,store).pi.readMessages('worker');assert.deepEqual(messages.filter(m=>m.role==='user').flatMap(m=>m.content.map(c=>c.text)),['inherited instruction','own instruction']);
 ctx.sessionPersistence.open=async()=>({header:original.header,inheritedEventCount:seed.length+1,read:async()=>({events:original.snapshotEvents()}),close:async()=>{}});await assert.rejects(()=>nativeExecution(ctx,store).pi.readMessages('worker'),/seeded session/);
});

test('task usage includes reported tokens from an interrupted model attempt',async()=>{
 const events=[{type:'assistant/attempt',seq:0,data:{stream:[{type:'chunk',time:1,chunk:{type:'usage',usage:{inputTokens:10,outputTokens:2,cacheReadTokens:4,cacheWriteTokens:0,totalTokens:16}}}]}},{type:'assistant/message',seq:1,data:{usage:{inputTokens:20,outputTokens:3,cacheReadTokens:8,cacheWriteTokens:0,totalTokens:31}}}];
 const store={get:()=>({id:'worker'}),setting:(_key,fallback)=>fallback,set:()=>{}};
 const ctx={on:()=>{},sessions:{messageProjections:[]},sessionPersistence:{open:async()=>({read:async()=>({events}),close:async()=>{}})},agents:{},tools:{}};
 const stats=await nativeExecution(ctx,store).pi.readUsage('worker');assert.deepEqual(stats.totalUsage,{inputTokens:30,outputTokens:5,cacheReadTokens:12,cacheWriteTokens:0,totalTokens:47});
});

test('last call reflects a failed attempt or summarization rather than an older answer',async()=>{
 const usage=(n)=>({inputTokens:n,outputTokens:2,cacheReadTokens:1,cacheWriteTokens:0,totalTokens:n+3});
 const events=[{type:'assistant/message',seq:0,data:{usage:usage(10)}},{type:'assistant/attempt',seq:1,data:{stream:[{type:'chunk',time:1,chunk:{type:'usage',usage:usage(20)}}]}}];
 const store={get:()=>({id:'worker'}),setting:(_key,fallback)=>fallback,set:()=>{}};
 const ctx={on:()=>{},sessions:{messageProjections:[]},sessionPersistence:{open:async()=>({read:async()=>({events}),close:async()=>{}})},agents:{},tools:{}};
 const read=()=>nativeExecution(ctx,store).pi.readUsage('worker');assert.equal((await read()).lastCall.inputTokens,20);
 events[1].data.stream=[];assert.deepEqual((await read()).lastCall,{available:false});
 events.push({type:'compaction/summary',seq:2,data:{llmStreamCall:true,usage:usage(30)}});assert.equal((await read()).lastCall.inputTokens,30);
});

test('usage is read from real persisted DSH attempt and message events',async()=>{
 const {mkdtemp,rm}=await import('node:fs/promises'),{join}=await import('node:path'),{tmpdir}=await import('node:os');
 const {Context}=await import('@deepseek-ai/cordis'),{Session}=await import('@deepseek-ai/dsh-session'),{createAssistantMessage}=await import('@deepseek-ai/dsh-llm');
 const persistence=await import('@deepseek-ai/dsh-session-persistence-jsonl'),dir=await mkdtemp(join(tmpdir(),'scrum-usage-persistence-')),host=new Context();
 try{
  await host.plugin(persistence.apply?persistence:persistence.default,{root:dir,compression:'none'});
  const session=Session.create('worker'),usage=n=>({inputTokens:n,outputTokens:2,cacheReadTokens:4,cacheWriteTokens:0,totalTokens:n+6});
  session.append('turn/start',{turn:1});session.append('step/start',{turn:1,step:1});
  session.append('assistant/attempt',{turn:1,step:1,stream:[{type:'chunk',time:1,chunk:{type:'usage',usage:usage(10)}}]});
  session.append('assistant/message',{turn:1,step:1,message:createAssistantMessage({content:[{type:'text',text:'done'}],source:{provider:'fixture',model:'fixture'}}),usage:usage(20)},{surfaceOp:'append'});
  const writer=await host.sessionPersistence.create(session.header);await writer.append(session.snapshotEvents());await writer.flush();await writer.close();
  const store={get:()=>({id:'worker'}),setting:(_key,fallback)=>fallback,set:()=>{}},ctx={on:()=>{},sessions:{messageProjections:[]},sessionPersistence:host.sessionPersistence,agents:{},tools:{}};
  const stats=await nativeExecution(ctx,store).pi.readUsage('worker');assert.equal(stats.lastCall.inputTokens,20);assert.equal(stats.totalUsage.inputTokens,30);assert.equal(stats.totalUsage.cacheReadTokens,8);
 }finally{await host.fiber.dispose();await rm(dir,{recursive:true,force:true})}
});
