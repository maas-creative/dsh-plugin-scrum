import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {ExecutionStore} from './execution-store.mjs';
import {createExecutionBridge} from './execution-api.mjs';
import {ParentReports} from './parent-reports.mjs';
import {DeliveryOutbox} from './delivery-outbox.mjs';
import {rolePolicy} from './roles.mjs';
import {prepareWorkspace} from './workspaces.mjs';
import {accountGoalUsage} from './goal-usage.mjs';
import {readExecutionState} from './controller.mjs';
import {ScrumCoordinator} from './runtime.mjs';
import {nativeExecution} from './native-runtime.mjs';
const exec=promisify(execFile);

async function fixture(){
 const dir=await mkdtemp(join(tmpdir(),'scrum-receipt-')),s=new ExecutionStore(join(dir,'execution.sqlite'));
 const events={history:()=>[],append:()=>{}};
 const runtime={s,list:()=>[],events,schedule:()=>{},handle:async()=>{throw Error('unexpected handle')}};
 return {dir,s,bridge:createExecutionBridge(runtime),runtime,close:async()=>{s.close();await rm(dir,{recursive:true,force:true})}};
}
const request=(dir,extra={})=>({prompt:'Write and verify result',cwd:dir,output:'result.md',completionCriteria:'Verified result',parentSessionId:'parent',...extra});

test('duplicate submission returns the stored receipt and never creates a second execution',async()=>{
 const f=await fixture();try{
  const first=await f.bridge.request(request(f.dir,{instructionId:'req-1'}));
  assert.equal(first.idempotentReplay,false);assert.match(first.receiptId,/^[0-9a-f-]{36}$/);assert.equal(first.instructionId,'req-1');
  const replay=await f.bridge.request(request(f.dir,{instructionId:'req-1'}));
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.receiptId,first.receiptId);assert.equal(replay.executionId,first.executionId);assert.equal(replay.payloadHash,first.payloadHash);
  assert.equal(f.s.snapshot().tasks.length,1);assert.equal(f.s.setting('scrumQueue:parent',[]).length,1);
  assert.equal(f.s.all('SELECT * FROM execution_receipts').length,1);
  await assert.rejects(f.bridge.request(request(f.dir,{instructionId:'req-1',prompt:'Different work'})),error=>error.status===409&&error.code==='receipt-conflict');
  assert.equal(f.s.snapshot().tasks.length,1);
  const legacyA=await f.bridge.request(request(f.dir)),legacyB=await f.bridge.request(request(f.dir));
  assert.notEqual(legacyA.receiptId,legacyB.receiptId);assert.equal(f.s.snapshot().tasks.length,3);
  const lookup=f.bridge.receipt({receiptId:first.receiptId,parentSessionId:'parent'});
  assert.equal(lookup.taskId,first.executionId);assert.equal(lookup.payloadHash,first.payloadHash);
  assert.throws(()=>f.bridge.receipt({receiptId:first.receiptId,parentSessionId:'foreign'}),/not found/);
 }finally{await f.close()}
});

test('receipt lookup rejects an invalid receiptId and a mismatched instructionId',async()=>{
 const f=await fixture();try{
  const accepted=await f.bridge.request(request(f.dir,{instructionId:'req-1'}));
  // A supplied but invalid receiptId is rejected with the specific message,
  // whether or not an instructionId accompanies it.
  for(const receiptId of ['',null,0,false,NaN,123,'   ']){
   assert.throws(()=>f.bridge.receipt({receiptId,parentSessionId:'parent'}),error=>error.status===400&&error.message==='receiptIdが不正です',String(receiptId));
   assert.throws(()=>f.bridge.receipt({receiptId,instructionId:'req-1',parentSessionId:'parent'}),error=>error.status===400&&error.message==='receiptIdが不正です',String(receiptId));
  }
  // Omitting both identifiers is a distinct error, not an invalid receiptId.
  assert.throws(()=>f.bridge.receipt({parentSessionId:'parent'}),error=>error.status===400&&error.message==='Execution receipt requires receiptId or instructionId');
  // receiptId and instructionId must agree.
  assert.throws(()=>f.bridge.receipt({receiptId:accepted.receiptId,instructionId:'other',parentSessionId:'parent'}),error=>error.status===409&&error.code==='receipt-mismatch'&&error.message==='receiptIdとinstructionIdが一致しません');
  // instructionId-only resolution still works.
  const byInstruction=f.bridge.receipt({instructionId:'req-1',parentSessionId:'parent'});
  assert.equal(byInstruction.receiptId,accepted.receiptId);assert.equal(byInstruction.taskId,accepted.executionId);
  // A matching pair resolves.
  const byBoth=f.bridge.receipt({receiptId:accepted.receiptId,instructionId:'req-1',parentSessionId:'parent'});
  assert.equal(byBoth.receiptId,accepted.receiptId);assert.equal(byBoth.payloadHash,accepted.payloadHash);
 }finally{await f.close()}
});

test('receipt lookup rejects an invalid instructionId even when a valid receiptId is supplied',async()=>{
 const f=await fixture();try{
  const accepted=await f.bridge.request(request(f.dir,{instructionId:'req-1'}));
  // A supplied but invalid instructionId is rejected with the specific message,
  // even when the receiptId alone would resolve the receipt.
  for(const instructionId of ['',0,false,null,NaN,123,'   ']){
   assert.throws(()=>f.bridge.receipt({receiptId:accepted.receiptId,instructionId,parentSessionId:'parent'}),error=>error.status===400&&error.message==='instructionIdが不正です',String(instructionId));
  }
  // Omitting instructionId keeps the receiptId-only lookup working.
  const byReceipt=f.bridge.receipt({receiptId:accepted.receiptId,parentSessionId:'parent'});
  assert.equal(byReceipt.receiptId,accepted.receiptId);assert.equal(byReceipt.instructionId,'req-1');
  // A matching pair still resolves.
  const byBoth=f.bridge.receipt({receiptId:accepted.receiptId,instructionId:'req-1',parentSessionId:'parent'});
  assert.equal(byBoth.receiptId,accepted.receiptId);assert.equal(byBoth.taskId,accepted.executionId);
 }finally{await f.close()}
});

test('running-state query reports the live assignment without re-accepting the submission',async()=>{
 const f=await fixture();try{
  const accepted=await f.bridge.request(request(f.dir,{instructionId:'running-1'}));
  f.runtime.list=()=>[{id:'a1',taskId:accepted.executionId,parentSession:'parent',status:'running',runId:'run-1',model:{provider:'local-deepseek',model:'deepseek-mia-jp'}}];
  const live=f.bridge.get({executionId:accepted.executionId,parentSessionId:'parent'});
  assert.equal(live.status,'running');assert.equal(live.receiptId,accepted.receiptId);assert.equal(live.verification.verified,false);
  const replay=await f.bridge.request(request(f.dir,{instructionId:'running-1'}));
  assert.equal(replay.idempotentReplay,true);assert.equal(replay.status,'running');assert.equal(f.s.snapshot().tasks.length,1);
 }finally{await f.close()}
});

test('notification retry re-sends the stored report without re-running the worker',async()=>{
 const f=await fixture();try{
  let prompts=0,deliveries=0,clock=0;
  // Real execution counter: any attempt to create a task or accept a receipt
  // during notification delivery would be a model re-execution.
  const task=f.s.task.bind(f.s),accept=f.s.acceptExecution.bind(f.s);
  f.s.task=(...args)=>{prompts++;return task(...args)};
  f.s.acceptExecution=(...args)=>{prompts++;return accept(...args)};
  // The real re-execution paths are the runtime tool handler and the model
  // prompt. Counting them proves a notification retry never reaches either.
  const handle=f.runtime.handle;
  f.runtime.handle=async(...args)=>{prompts++;return handle(...args)};
  f.runtime.pi={prompt:async()=>{prompts++;throw Error('unexpected prompt')}};
  const reports=new ParentReports(f.s,{list:()=>[],deliver:async()=>{deliveries++;if(deliveries===1)throw Error('接続失敗')},debounceMs:0,now:()=>clock});
  reports.enqueue({id:'a1',parentSession:'parent',taskId:'t1',taskVersion:1,status:'review',result:'done',artifact:{path:'/report',hash:'h'}});
  await reports.flush();
  const failed=f.s.all('SELECT * FROM delivery_outbox')[0];
  assert.equal(failed.state,'pending');assert.equal(failed.attempts,1);assert.equal(failed.lastError,'接続失敗');
  assert.equal(f.s.all('SELECT * FROM delivery_attempts').length,1);
  assert.equal(f.s.all('SELECT * FROM delivery_outbox').length,1,'failed delivery keeps exactly one outbox row');
  assert.equal(f.s.all('SELECT * FROM parent_wake_receipts')[0].state,'failed','failed wake is recorded for restart recovery');
  assert.equal(f.s.snapshot().tasks.length,0,'notification failure must not create an execution');
  assert.equal(f.s.all('SELECT * FROM execution_receipts').length,0,'notification failure must not accept a receipt');
  clock=3000;await reports.flush();
  const delivered=f.s.all('SELECT * FROM delivery_outbox')[0];
  assert.equal(delivered.state,'delivered');assert.equal(delivered.attempts,2);assert.equal(delivered.deliveredAt!==null,true);
  assert.equal(f.s.all('SELECT * FROM delivery_attempts').length,2);
  assert.equal(f.s.all('SELECT * FROM parent_wake_receipts')[0].state,'completed','successful wake receipt is completed');
  assert.equal(prompts,0,'notification retry must not execute the model');
  assert.equal(f.s.all('SELECT * FROM tasks').length,0,'retry must not create a task row');
  assert.equal(deliveries,2);
  assert.equal(f.s.all('SELECT * FROM delivery_outbox').length,1,'history is retained, not overwritten');
  assert.equal(f.s.snapshot().tasks.length,0,'retry must not create an execution');
  assert.equal(f.s.all('SELECT * FROM execution_receipts').length,0,'retry must not accept a receipt');
 }finally{await f.close()}
});

test('undelivered notifications survive restart and expired leases are recovered',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-restart-')),path=join(dir,'execution.sqlite');
 let s=new ExecutionStore(path);
 const sent=[];
 const first=new ParentReports(s,{list:()=>[],deliver:async()=>{throw Error('offline')},debounceMs:0});
 first.enqueue({id:'a1',parentSession:'parent',taskId:'t1',taskVersion:1,status:'review',result:'done'});
 await first.flush();
 assert.equal(s.all('SELECT * FROM delivery_outbox')[0].state,'pending');
 // A crash between claim and delivery leaves a lease; the next process retries it.
 s.run("UPDATE delivery_outbox SET state='delivering',leaseUntil=?,batchId='stale',nextAt=0",Date.now()-1000);
 s.close();
 s=new ExecutionStore(path);
 assert.equal(s.all('SELECT * FROM delivery_outbox').length,1,'undelivered notification survives restart');
 const recovered=new ParentReports(s,{list:()=>[],deliver:async(parent,batch)=>sent.push(batch),debounceMs:0});
 await recovered.flush();
 assert.equal(sent.length,1);assert.equal(s.all('SELECT * FROM delivery_outbox')[0].state,'delivered');
 assert.equal(s.all('SELECT * FROM delivery_attempts').length,2);
 s.close();await rm(dir,{recursive:true,force:true});
});

test('Goal continuation state and usage survive reopening the ledger',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-goal-')),path=join(dir,'execution.sqlite');
 let s=new ExecutionStore(path);
 s.set('ulw:parent',{active:true,goal:'受付・実行・通知の分離',startedAt:1234,phase:'execution',concurrency:2,executionOnly:true});
 accountGoalUsage(s,'parent',{sessionId:'s1',seq:1,kind:'assistant/message',inputTokens:10,outputTokens:5});
 s.close();
 s=new ExecutionStore(path);
 const state=readExecutionState(s,'parent');
 assert.equal(state.goal,'受付・実行・通知の分離');assert.equal(state.startedAt,1234);assert.equal(state.phase,'execution');
 assert.equal(s.get('SELECT SUM(tokens) AS tokens FROM scrum_goal_usage WHERE parent=?','parent').tokens,15);
 s.close();await rm(dir,{recursive:true,force:true});
});

test('worker isolation keeps read-only roles away from writes and refuses a dirty shared workspace',async()=>{
 for(const role of ['researcher','reviewer']){
  const policy=rolePolicy(role,process.cwd());
  assert.equal(policy.readOnly,true,role);assert(!policy.allow.includes('write'),role);assert(!policy.allow.includes('edit'),role);
 }
 const planner=rolePolicy('planner',process.cwd());
 assert.equal(planner.planningOnly,true);assert(!planner.allow.includes('bash'));
 const executor=rolePolicy('executor',process.cwd());
 assert.equal(executor.readOnly,false);assert(executor.deny.includes('subagent'));assert(executor.deny.includes('send_message'));
 const validator=rolePolicy('validator',process.cwd());
 assert.equal(validator.readOnly,true);assert(!validator.allow.includes('write'));assert(!validator.allow.includes('edit'));assert(!validator.allow.includes('subagent'));assert(!validator.allow.includes('send_message'));
 const dir=await mkdtemp(join(tmpdir(),'scrum-dirty-')),repo=join(dir,'repo');
 await mkdir(repo);await exec('git',['init','-q'],{cwd:repo});await exec('git',['config','user.email','test@example.com'],{cwd:repo});await exec('git',['config','user.name','Test'],{cwd:repo});
 await writeFile(join(repo,'tracked.txt'),'clean');await exec('git',['add','.'],{cwd:repo});await exec('git',['commit','-qm','base'],{cwd:repo});
 await writeFile(join(repo,'tracked.txt'),'dirty');
 const s=new ExecutionStore(join(dir,'execution.sqlite'));
 await assert.rejects(prepareWorkspace(s,dir,{cwd:repo},'task-1'),/未コミットの変更/);
 s.close();await rm(dir,{recursive:true,force:true});
});

test('notification retry after restart re-delivers through the real coordinator without re-running the worker',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-e2e-')),dir=join(root,'workspace'),dataDir=join(root,'scrum-state');
 await mkdir(dir);await mkdir(dataDir);
 const dbPath=join(dataDir,'db');
 let s=new ExecutionStore(dbPath);
 const taskId=s.task({parentSession:'parent',cwd:dir,title:'Notification retry',owner:'Pi',status:'todo',body:'Produce the verified result',inputs:'evidence.txt',output:'report.md',completionCriteria:'Verified result',nextAction:'Produce'});
 const ctx={on(){},tools:{register(){}},commands:{register(){}}};
 const native=nativeExecution(ctx,s);
 let prompts=0,deliveries=0;const delivered=[];
 const pi={sessions:new Map(),release:async()=>{},prompt:async(runId,message,id)=>{prompts++;s.set('pi-send:'+id,{status:'completed',result:'Task work finished',toolEvidence:[{name:'scrum_report'}]});}};
 const r=new ScrumCoordinator(s,dataDir,pi,native.io);r.schedule=()=>{};
 const dispatch=()=>r.handle({method:'task',parentSession:'parent',args:{taskId,prompt:'Produce the verified result',subagent_type:'validator',run_in_background:false,timeout_ms:2000}});
 const first=await dispatch();
 assert.equal(first.status,'review');assert.equal(prompts,1);
 assert.equal(s.all('SELECT * FROM delivery_outbox').length,1);
 const counts=()=>({tasks:s.all('SELECT * FROM tasks').length,receipts:s.all('SELECT * FROM execution_receipts').length,assignments:s.all('SELECT * FROM assignments').length});
 const before=counts();
 s.run("UPDATE delivery_outbox SET nextAt=0");
 r.connectParent({deliver:async(parent,batch)=>{deliveries++;if(deliveries===1)throw Error('parent delivery failed');delivered.push(batch);},isBusy:async()=>false,requestPlan:async()=>{},connectionForWorker:()=>null});
 await r.tick();
 assert.equal(deliveries,1);assert.equal(delivered.length,0);
 assert.equal(s.all('SELECT * FROM delivery_outbox')[0].state,'pending');
 await r.close();s.close();
 s=new ExecutionStore(dbPath);
 s.run("UPDATE delivery_outbox SET nextAt=0");
 const pi2={sessions:new Map(),release:async()=>{},prompt:async()=>{throw Error('worker must not run again');}};
 const r2=new ScrumCoordinator(s,dataDir,pi2,native.io);r2.schedule=()=>{};
 r2.connectParent({deliver:async(parent,batch)=>{deliveries++;delivered.push(batch);},isBusy:async()=>false,requestPlan:async()=>{},connectionForWorker:()=>null});
 await r2.tick();
 assert.equal(deliveries,2);assert.equal(delivered.length,1);
 assert.equal(delivered[0].reports.length,1);
 assert.equal(s.all('SELECT * FROM delivery_outbox')[0].state,'delivered');
 assert.equal(s.all('SELECT * FROM delivery_attempts').length,2);
 assert.deepEqual(counts(),before);
 assert.equal(prompts,1);
 await r2.close();s.close();await rm(root,{recursive:true,force:true});
});
