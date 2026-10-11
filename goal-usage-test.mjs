import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {Store} from './ledger.mjs';import {accountGoalUsage,registerGoalUsage} from './goal-usage.mjs';
test('goal usage is durable, duplicate-safe and pauses without losing prior totals',()=>{
 const directory=mkdtempSync(join(tmpdir(),'scrum-goal-usage-'));let store=new Store(join(directory,'db'));
 try{
  store.set('ulw:parent',{goal:'Verified result',startedAt:1,active:true,phase:'running'});
  const event={sessionId:'worker',seq:3,kind:'assistant/message',inputTokens:20,outputTokens:10};
  assert.equal(accountGoalUsage(store,'parent',event).tokensUsed,30);assert.equal(accountGoalUsage(store,'parent',event).tokensUsed,30);
  assert.equal(accountGoalUsage(store,'parent',{sessionId:'worker',seq:4,kind:'turn/end',elapsedSeconds:5}).timeUsedSeconds,5);
  store.close();store=new Store(join(directory,'db'));assert.equal(accountGoalUsage(store,'parent',event).tokensUsed,30);
  store.set('ulw:parent',{...store.setting('ulw:parent'),phase:'paused'});assert.equal(accountGoalUsage(store,'parent',{...event,seq:5}).tokensUsed,30);
  assert.throws(()=>accountGoalUsage(store,'parent',{...event,inputTokens:-1}),/Invalid usage amount/);
 }finally{store.close();rmSync(directory,{recursive:true,force:true})}
});
test('native session events connect actual usage and elapsed turn time to the accounting adapter',async()=>{
 const hooks={},calls=[];registerGoalUsage({on:(name,fn)=>hooks[name]=fn,effect(){}},async(...args)=>calls.push(args));
 const session={id:'parent',snapshotEvents:()=>[{seq:0,type:'turn/start',time:1000,data:{turn:0}}]};
 hooks['session/event'](session,{seq:1,type:'assistant/message',time:2000,data:{usage:{inputTokens:7,outputTokens:3}}});
 hooks['session/event'](session,{seq:2,type:'turn/end',time:6000,data:{turn:0}});await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls[0][0],'goal_usage');assert.equal(calls[0][1].inputTokens,7);assert.equal(calls[1][1].elapsedSeconds,5);assert.equal(calls[0][2],'parent');
});

test('missing native usage remains unavailable across restart and can be repaired once without duplicate totals',()=>{const directory=mkdtempSync(join(tmpdir(),'scrum-unknown-usage-')),path=join(directory,'db');let store=new Store(path);try{store.set('ulw:p',{goal:'Known accounting',startedAt:1,active:true,phase:'running'});const event={sessionId:'p',seq:1,kind:'assistant/message'};let state=accountGoalUsage(store,'p',event);assert.equal(state.usageAvailability,'incomplete');assert.equal(state.usageUnavailableEvents,1);store.close();store=new Store(path);assert.equal(accountGoalUsage(store,'p',event).usageUnavailableEvents,1);state=accountGoalUsage(store,'p',{...event,inputTokens:11,outputTokens:4});assert.equal(state.tokensUsed,15);assert.equal(state.usageAvailability,'available');assert.equal(accountGoalUsage(store,'p',{...event,inputTokens:11,outputTokens:4}).tokensUsed,15);state=accountGoalUsage(store,'p',{sessionId:'p',seq:2,kind:'turn/end',timeAvailable:false});assert.equal(state.usageAvailability,'incomplete');assert.equal(state.timeUsedSeconds,0);}finally{store.close();rmSync(directory,{recursive:true,force:true})}});
test('missing assistant usage and turn timestamps are reported explicitly by native event adapter',async()=>{const hooks={},calls=[],warnings=[];registerGoalUsage({on:(name,fn)=>hooks[name]=fn,effect(){},logger:{warn:message=>warnings.push(message)}},async(...args)=>calls.push(args));const session={id:'p',snapshotEvents:()=>[]};hooks['session/event'](session,{seq:1,type:'assistant/message',data:{}});hooks['session/event'](session,{seq:2,type:'turn/end',data:{turn:0}});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls[0][1].usageAvailable,false);assert.equal(calls[0][1].inputTokens,undefined);assert.equal(calls[1][1].timeAvailable,false);assert.equal(warnings.length,2)});
