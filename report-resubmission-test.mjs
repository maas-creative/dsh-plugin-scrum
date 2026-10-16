import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Store} from './ledger.mjs';
import {ExecutionStore} from './execution-store.mjs';
import {ScrumCoordinator} from './runtime.mjs';
import {nativeExecution} from './native-runtime.mjs';
import {registerStandaloneTools} from './standalone.mjs';
import {workerReportPath} from './report.mjs';
const digest=text=>createHash('sha256').update(text).digest('hex');

async function fixture(StoreType,role='executor'){
 const root=await realpath(await mkdtemp(join(tmpdir(),'scrum-resubmit-'))),dir=join(root,'workspace'),dataDir=join(root,'scrum-state');await mkdir(dir);await mkdir(dataDir);const s=new StoreType(join(dataDir,'db'));
 const projectId=s.executionOnly?undefined:s.project({name:'Report recovery',cwd:dir,execution:'auto',outcome:'Diagnose the incident',output:'report.md',basis:'User-authorized regression fixture',completionCriteria:'Evidence and safe recovery verified'});
 const taskId=s.task({...(s.executionOnly?{parentSession:'parent',cwd:dir}:{projectId}),title:'Diagnosis',owner:'Pi',status:'todo',body:'Read the evidence; diagnose and propose safe recovery',inputs:'evidence.txt',output:'report.md',completionCriteria:'Cause and evidence with nginx -t and proxy health check',nextAction:'Diagnose'});
 const definitions=new Map(),ctx={on(){},tools:{register:tool=>definitions.set(tool.name,tool)},commands:{register(){}}};
 const native=nativeExecution(ctx,s),released=[],pi={sessions:new Map(),release:async id=>released.push(id)};
 const r=new ScrumCoordinator(s,dataDir,pi,native.io);r.schedule=()=>{};
 await registerStandaloneTools(ctx,r);
 let revision='first diagnosis';
 pi.prompt=async(runId,message,id)=>{
  const assignment=r.list().find(a=>a.id===id),exec={agent:{session:{id:runId}}};
  if(role==='executor')await writeFile(join(dir,'report.md'),revision);
  const value=role==='executor'?'Performed diagnosis and checks':revision;
  const report=await definitions.get('scrum_report').execute({content:value},exec);
  assert.equal(await readFile(join(dir,'report.md'),'utf8'),revision);
  if(role==='executor'){assert.notEqual(report,join(dir,'report.md'));assert(!report.startsWith(dir+'/'));assert.equal(report,workerReportPath(dataDir,assignment.id));assert.equal(await readFile(report,'utf8'),value);}
  s.set('pi-send:'+id,{status:'completed',result:'Task work finished',toolEvidence:[{name:'read'},{name:'write'}]});
 };
 const dispatch=()=>r.handle({method:'task',parentSession:'parent',args:{taskId,prompt:'Diagnose',subagent_type:role,run_in_background:false,timeout_ms:2000}});
 return {dir,dataDir,s,r,taskId,definitions,released,dispatch,review:reviews=>definitions.get('scrum_review').execute({input:{reviews}},{agent:{session:{id:'parent'}}}),setRevision:value=>revision=value,close:async()=>{await r.close();s.close();await rm(root,{recursive:true,force:true})}};
}

for(const StoreType of [Store,ExecutionStore]){
 test(`${StoreType.name}: preserve artifact, reject, public task resubmit and approve only new assignment/hash`,async()=>{
  const f=await fixture(StoreType);try{
   const first=await f.dispatch();assert.equal(first.status,'review');
   const a=f.r.list().find(a=>a.id===first.assignmentId);assert.equal(a.artifact.hash,digest('first diagnosis'));
   assert.match(a.instruction,/成果物を置換しません/);
   await f.review([{assignmentId:a.id,accept:false,reason:'Missing safe recovery check'}]);
   await assert.rejects(f.review([{assignmentId:a.id,accept:true,hash:a.artifact.hash,reason:'Try old assignment'}]),error=>error.status===409&&/blocked/.test(error.message)&&/session_id/.test(error.message)&&error.message.includes(a.runId));
   // Editing the file cannot re-open a blocked assignment or complete its task.
   await writeFile(join(f.dir,'report.md'),'human edit');
   await assert.rejects(f.review([{assignmentId:a.id,accept:true,hash:digest('human edit'),reason:'Edited only'}]),/blocked/);
   assert.equal(f.s.snapshot().tasks.find(t=>t.id===f.taskId).status,'review');
   f.setRevision('corrected diagnosis with nginx -t and proxy health check');
   const next=await f.r.handle({method:'task',parentSession:'parent',args:{taskId:f.taskId,session_id:a.runId,prompt:'Fix rejected report and resubmit',run_in_background:false,timeout_ms:2000}});
   assert.equal(next.status,'review');assert.notEqual(next.assignmentId,a.id);assert.equal(next.session_id,a.runId);
   const fresh=f.r.list().find(a=>a.id===next.assignmentId);assert.equal(f.r.list().find(x=>x.id===a.id).status,'cancelled');
   assert.notEqual(fresh.artifact.hash,a.artifact.hash);assert.equal(f.s.setting('runReport:'+a.runId),workerReportPath(f.dataDir,fresh.id));
   await assert.rejects(f.review([{assignmentId:a.id,accept:true,hash:fresh.artifact.hash,reason:'Wrong ID'}]),/cancelled/);
   await assert.rejects(f.review([{assignmentId:fresh.id,accept:true,hash:a.artifact.hash,reason:'Old hash'}]),/全内容/);
   // A collected hash must still match the file on disk at approval time.
   const correct=await readFile(join(f.dir,'report.md'),'utf8');await writeFile(join(f.dir,'report.md'),'changed after collect');
   await assert.rejects(f.review([{assignmentId:fresh.id,accept:true,hash:fresh.artifact.hash,reason:'Stale file'}]),/成果物が変更/);
   await writeFile(join(f.dir,'report.md'),correct);
   await f.review([{assignmentId:fresh.id,accept:true,hash:fresh.artifact.hash,reason:'Full report and tool evidence checked'}]);
   const task=f.s.snapshot().tasks.find(t=>t.id===f.taskId),done=f.r.list().find(a=>a.id===fresh.id);
   assert.equal(task.status,'done');assert(task.completedAt);assert(task.completionEvidence.includes(fresh.artifact.hash));
   assert.equal(done.status,'done');assert.equal(done.resourcesReleased,true);assert.deepEqual(f.released,[a.runId]);
   assert.equal(f.s.all('SELECT * FROM deliverables').length,1);assert.equal(f.s.all('SELECT * FROM deliverables')[0].hash,fresh.artifact.hash);
  }finally{await f.close()}
 });
 test(`${StoreType.name}: mailbox request IDs use a safe separate report path on followup`,async()=>{
  const f=await fixture(StoreType);try{await f.dispatch();const a=f.r.list()[0];await f.review([{assignmentId:a.id,accept:false,reason:'Needs correction'}]);f.setRevision('Corrected by mailbox instruction');const requestId='mail:request/with-special-id';await f.r.followup(a.runId,'Correct the report',requestId);await f.r.collect();const fresh=f.r.list().find(a=>a.id===requestId);assert.equal(fresh.status,'review');assert.equal(f.s.setting('runReport:'+a.runId),join(f.dataDir,'.scrum-reports',digest(requestId)+'.md'));assert.equal(await readFile(join(f.dir,'report.md'),'utf8'),'Corrected by mailbox instruction');}finally{await f.close()}
 });
 test(`${StoreType.name}: task version change still blocks approval`,async()=>{
  const f=await fixture(StoreType);try{await f.dispatch();const a=f.r.list()[0],task=f.s.snapshot().tasks.find(t=>t.id===f.taskId);f.s.task({...task,title:'Updated scope'});await assert.rejects(f.review([{assignmentId:a.id,accept:true,hash:a.artifact.hash,reason:'Stale task version'}]),/タスク・プロジェクトが更新/);assert.equal(f.s.all('SELECT * FROM deliverables').length,0);assert.equal(f.s.snapshot().tasks.find(t=>t.id===f.taskId).status,'review');}finally{await f.close()}
 });
 test(`${StoreType.name}: read-only report remains the full task artifact`,async()=>{
  const f=await fixture(StoreType,'researcher');try{const result=await f.dispatch();assert.equal(result.status,'review');assert.equal(result.artifact.hash,digest('first diagnosis'));assert.equal(f.s.setting('runReport:'+result.session_id),join(f.dir,'report.md'));assert.match(f.r.list()[0].instruction,/報告書自体が成果物/);}finally{await f.close()}
 });
 test(`${StoreType.name}: legacy writable runReport cannot overwrite its artifact and inactive report is rejected`,async()=>{
  const f=await fixture(StoreType);try{
   const result=await f.dispatch(),a=f.r.list()[0];f.r.save(a,{status:'running'});f.s.set('runReport:'+a.runId,join(f.dir,'report.md'));
   const report=f.definitions.get('scrum_report'),exec={agent:{session:{id:a.runId}}};await report.execute({content:'Legacy summary'},exec);
   assert.equal(await readFile(join(f.dir,'report.md'),'utf8'),'first diagnosis');assert.equal(await readFile(workerReportPath(f.dataDir,a.id),'utf8'),'Legacy summary');
   f.r.save(f.r.list()[0],{status:'blocked'});await assert.rejects(report.execute({content:'Late report'},exec),/Active assigned worker/);
   assert.equal(result.status,'review');
  }finally{await f.close()}
 });
}
