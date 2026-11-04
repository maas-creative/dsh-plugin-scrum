import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeExecution} from './native-runtime.mjs';

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
