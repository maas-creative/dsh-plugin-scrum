import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './ledger.mjs';
import {TeamStore} from './team.mjs';
test('shutdown request and response use durable mailboxes without duplicate delivery',()=>{
 const dir=mkdtempSync(join(tmpdir(),'team-shutdown-mail-')),s=new Store(join(dir,'db'));try{const teams=new TeamStore(s),team=teams.create({name:'mail',parentSession:'lead'});teams.member(team.id,'lead',{name:'worker',sessionId:'worker'});const request=teams.shutdown(team.id,'lead',{member:'worker',reason:'finish'}).shutdownRequests[0];teams.shutdown(team.id,'lead',{member:'worker',reason:'finish'});assert.equal(s.setting('scrumMailbox:worker').length,1);assert.equal(s.setting('scrumMailbox:worker')[0].requestId,request.id);assert.equal(s.setting('scrumMailbox:worker')[0].kind,'shutdown_request');teams.shutdown(team.id,'lead',{member:'worker',requestId:request.id,accept:true});teams.shutdown(team.id,'lead',{member:'worker',requestId:request.id,accept:true});assert.equal(s.setting('scrumMailbox:lead').length,1);assert.equal(s.setting('scrumMailbox:lead')[0].kind,'shutdown_approved');assert.equal(s.setting('scrumContinue:lead'),true);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
import {DagStore} from './dag.mjs';
test('persisted team claims and DAG dependency leases use canonical tasks',()=>{
 const dir=mkdtempSync(join(tmpdir(),'team-dag-'));let s=new Store(join(dir,'db'));
 try{
 const p=s.project({name:'Test'}),a=s.task({projectId:p,title:'A',status:'todo'}),b=s.task({projectId:p,title:'B',status:'todo',dependencies:[a]});
 let teams=new TeamStore(s),dags=new DagStore(s);const team=teams.create({name:'Builders',parentSession:'parent',projectIds:[p]});
 teams.member(team.id,'parent',{name:'worker',sessionId:'run'});
 assert.throws(()=>teams.claim(team.id,'parent',{taskId:b,member:'worker'}),/Blocked/);
 const claimed=teams.claim(team.id,'parent',{taskId:a,member:'worker'});assert.throws(()=>teams.claim(team.id,'parent',{taskId:a,member:'worker'}),/claimed/);
 teams.release(team.id,'parent',{taskId:a,token:claimed.claims[a].token});
 const dag=dags.create({parentSession:'parent',taskIds:[a,b]});assert.deepEqual(dags.frontier(dag.id,'parent'),[a]);
 let d=dags.claim(dag.id,'parent',{taskId:a,owner:'worker'}),token=d.nodes[a].token;
 dags.checkpoint(dag.id,'parent',{taskId:a,token,data:{file:'a.md'}});
 assert.throws(()=>dags.finish(dag.id,'parent',{taskId:a,token}),/review/);
 dags.finish(dag.id,'parent',{taskId:a,token,error:'temporary',retryDelayMs:0});d=dags.claim(dag.id,'parent',{taskId:a,owner:'worker'});
 s.run("UPDATE tasks SET status='done' WHERE id=?",a);dags.finish(dag.id,'parent',{taskId:a,token:d.nodes[a].token});
 assert.deepEqual(dags.frontier(dag.id,'parent'),[b]);assert.throws(()=>dags.amend(dag.id,'parent',{taskIds:[a],version:1}),/conflict/);
 d=dags.claim(dag.id,'parent',{taskId:b,owner:'worker'});dags.reconcile(dag.id,'parent',{liveOwners:[]});assert.equal(dags.get(dag.id).nodes[b].state,'pending');
 const req=teams.shutdown(team.id,'parent',{member:'worker'}).shutdownRequests[0];teams.shutdown(team.id,'parent',{member:'worker',requestId:req.id,accept:true});assert.throws(()=>teams.delete(team.id,'parent'),/Stop members/);teams.update(team.id,'parent',t=>{t.members[0].status='stopped'});teams.delete(team.id,'parent');
 s.close();s=new Store(join(dir,'db'));teams=new TeamStore(s);dags=new DagStore(s);
 assert.equal(teams.get(team.id).status,'deleted');assert.equal(dags.get(dag.id).nodes[a].checkpoint.file,'a.md');assert.ok(dags.replay(dag.id,'parent').length>=7);assert.equal(s.get('SELECT COUNT(*) AS n FROM tasks').n,2);
 assert.throws(()=>dags.get(dag.id,'other'),/parent/);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
test('DAG tick dispatches frontier once and enforces caller ownership',async()=>{
 const {tickDags,handleTeamDag}=await import('./dag.mjs'),dir=mkdtempSync(join(tmpdir(),'dag-tick-')),s=new Store(join(dir,'db'));
 try{const p=s.project({name:'Tick'}),id=s.task({projectId:p,title:'Execute',owner:'Pi',status:'todo'}),assignments=[],calls=[];
 const runtime={s,list:()=>assignments,state:()=>({projectIds:[p]}),reports:{isBusy:async()=>false},dispatch:async(picks,parentSession)=>{calls.push(picks);assignments.push({id:'assignment',taskId:id,parentSession,runId:'worker',status:'running'})},schedule(){}};
 // Snapshot actionable is calculated by Store from project/task readiness; supply only readiness in this adapter test.
 const snapshot=s.snapshot.bind(s);s.snapshot=()=>{const v=snapshot();v.tasks=v.tasks.map(t=>({...t,actionable:true}));return v};
 const d=await handleTeamDag(runtime,{method:'dag_create',args:{taskIds:[id]},parentSession:'parent'});
 await tickDags(runtime);await tickDags(runtime);assert.equal(calls.length,1);assert.equal(new DagStore(s).get(d.id).nodes[id].owner,'worker');
 await assert.rejects(handleTeamDag(runtime,{method:'dag_amend',args:{id:d.id,taskIds:[id]},parentSession:'parent',callerSession:'worker'}),/Lead-only/);
 const n=new DagStore(s).get(d.id).nodes[id];await handleTeamDag(runtime,{method:'dag_checkpoint',args:{id:d.id,taskId:id,token:n.token,data:{offset:2}},parentSession:'parent',callerSession:'worker'});
 assert.equal(new DagStore(s).get(d.id).nodes[id].checkpoint.offset,2);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
test('DAG definition idempotency, history reconstruction and bounded overflow survive restart',()=>{const dir=mkdtempSync(join(tmpdir(),'dag-replay-'));let s=new Store(join(dir,'db'));try{const p=s.project({name:'Replay'}),id=s.task({projectId:p,title:'A',status:'todo'});let dags=new DagStore(s);const input={parentSession:'parent',taskIds:[id],idempotency_key:'create-once'},d=dags.create(input);assert.equal(dags.create(input).id,d.id);assert.throws(()=>dags.create({...input,name:'different'}),/idempotency conflict/);const version=d.version;assert.equal(dags.reconcile(d.id,'parent').version,version);const claimed=dags.claim(d.id,'parent',{taskId:id,owner:'worker'});dags.checkpoint(d.id,'parent',{taskId:id,token:claimed.nodes[id].token,data:{offset:3}});assert.equal(dags.reconstruct(d.id,'parent',1).nodes[id].state,'pending');assert.equal(dags.reconstruct(d.id,'parent',2).nodes[id].state,'running');const sub=dags.subscription(d.id,'parent',{capacity:1});assert.equal(sub.overflow,true);assert.equal(sub.events[0].type,'dag.stream.overflow');assert.equal(sub.events[1].type,'checkpoint');assert.equal(dags.subscription(d.id,'parent',{after:sub.cursor}).events.length,0);s.close();s=new Store(join(dir,'db'));dags=new DagStore(s);assert.equal(dags.reconstruct(d.id,'parent',3).nodes[id].checkpoint.offset,3);assert.equal(dags.create(input).id,d.id)}finally{s.close();rmSync(dir,{recursive:true,force:true})}});
test('paused stopped and completed parents cannot claim Team/DAG work but retain checkpoints',async()=>{
 const {handleTeamDag}=await import('./dag.mjs'),dir=mkdtempSync(join(tmpdir(),'dag-stopped-')),s=new Store(join(dir,'db'));
 try{const p=s.project({name:'Stopped'}),taskId=s.task({projectId:p,title:'Work',status:'todo'}),teams=new TeamStore(s),dags=new DagStore(s),team=teams.create({parentSession:'parent',projectIds:[p],name:'Team'});teams.member(team.id,'parent',{name:'worker',sessionId:'worker'});const dag=dags.create({parentSession:'parent',taskIds:[taskId]}),claim=dags.claim(dag.id,'parent',{taskId,owner:'worker'}),token=claim.nodes[taskId].token;
 const runtime={s,list:()=>[{runId:'worker',taskId,parentSession:'parent'}],schedule:()=>{}};
 for(const phase of ['paused','stopped','completed']){s.set('ulw:parent',{phase,projectIds:[p]});for(const method of ['team_create','team_claim','dag_create','dag_claim'])await assert.rejects(handleTeamDag(runtime,{method,args:{id:method.startsWith('team')?team.id:dag.id,taskId,member:'worker',owner:'worker'},parentSession:'parent'}),/Stopped/);assert.deepEqual(await handleTeamDag(runtime,{method:'dag_frontier',args:{id:dag.id},parentSession:'parent'}),[]);assert.equal((await handleTeamDag(runtime,{method:'dag_get',args:{id:dag.id},parentSession:'parent'})).id,dag.id);}
 await handleTeamDag(runtime,{method:'dag_checkpoint',args:{id:dag.id,taskId,token,data:{evidence:'retained'}},parentSession:'parent',callerSession:'worker'});assert.equal(dags.get(dag.id).nodes[taskId].checkpoint.evidence,'retained');
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
test('team participation fences lead and member identities across restart',()=>{
 const dir=mkdtempSync(join(tmpdir(),'team-participation-'));let s=new Store(join(dir,'db'));
 try{let teams=new TeamStore(s);const one=teams.create({name:'One',parentSession:'lead-one'}),two=teams.create({name:'Two',parentSession:'lead-two'});teams.member(one.id,'lead-one',{name:'worker',sessionId:'worker'});
 assert.throws(()=>teams.create({name:'Duplicate lead',parentSession:'lead-one'}),/participates/);assert.throws(()=>teams.create({name:'Member as lead',parentSession:'worker'}),/participates/);assert.throws(()=>teams.member(two.id,'lead-two',{name:'duplicate',sessionId:'worker'}),/participates/);assert.throws(()=>teams.member(one.id,'lead-one',{name:'self',sessionId:'lead-one'}),/participates/);
 s.close();s=new Store(join(dir,'db'));teams=new TeamStore(s);assert.equal(teams.participant('worker').id,one.id);assert.throws(()=>teams.member(two.id,'lead-two',{name:'duplicate',sessionId:'worker'}),/participates/);
 const request=teams.shutdown(one.id,'lead-one',{member:'worker'}).shutdownRequests[0];teams.shutdown(one.id,'lead-one',{member:'worker',requestId:request.id,accept:true});assert.throws(()=>teams.member(two.id,'lead-two',{name:'worker',sessionId:'worker'}),/already participates/);teams.update(one.id,'lead-one',t=>{t.members[0].status='stopped'});teams.member(two.id,'lead-two',{name:'worker',sessionId:'worker'});assert.equal(teams.participant('worker').id,two.id);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});

test('accepted shutdown survives restart, retries real adapter failure and reports completion once',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),{ThreadStore}=await import('./thread.mjs'),dir=mkdtempSync(join(tmpdir(),'team-stop-')),s=new Store(join(dir,'db'));try{let calls=0,busy=true;const threads=new ThreadStore(s,{create:async()=>({sessionId:'worker'}),interrupt:async()=>{calls++;if(calls===1)throw Error('fixture abort failure');return {interrupted:true}}});await threads.handle({method:'thread_create',args:{name:'worker'},parentSession:'parent'});const teams=new TeamStore(s),team=teams.create({name:'stop',parentSession:'parent'});teams.member(team.id,'parent',{name:'worker',sessionId:'worker'});const request=teams.shutdown(team.id,'parent',{member:'worker'}).shutdownRequests[0];teams.shutdown(team.id,'parent',{member:'worker',requestId:request.id,accept:true});assert.equal(calls,0);const key='scrumTeamStop:'+request.id;s.set(key,{...s.setting(key),nextAt:0});
 const runtime=()=>Object.assign(Object.create(ScrumCoordinator.prototype),{s,threads,schedule(){},list:()=>[],reports:{isBusy:async()=>busy}});await runtime().stopTeamMembers();assert.equal(calls,0);busy=false;await runtime().stopTeamMembers();assert.equal(teams.get(team.id).members[0].status,'shutdown_approved');assert.match(s.setting(key).error,/abort failure/);s.set(key,{...s.setting(key),nextAt:0});await runtime().stopTeamMembers();assert.equal(calls,2);assert.equal(teams.get(team.id).members[0].status,'stopped');assert.equal(s.setting(key).status,'completed');await runtime().stopTeamMembers();assert.equal(calls,2);assert.equal(s.setting('scrumMailbox:parent').filter(m=>m.kind==='shutdown_completed').length,1);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});

test('worker shutdown capability answers only its own request and never gains lead operations',async()=>{
 const {handleTeamDag}=await import('./dag.mjs'),dir=mkdtempSync(join(tmpdir(),'team-worker-protocol-')),s=new Store(join(dir,'db'));
 try{const projectId=s.project({name:'Protocol'}),taskId=s.task({projectId,title:'Owned',status:'todo'}),teams=new TeamStore(s),team=teams.create({name:'Owned',parentSession:'lead',projectIds:[projectId]});teams.member(team.id,'lead',{name:'one',sessionId:'worker-one'});teams.member(team.id,'lead',{name:'two',sessionId:'worker-two'});const own=teams.shutdown(team.id,'lead',{member:'one'}).shutdownRequests[0],peer=teams.shutdown(team.id,'lead',{member:'two'}).shutdownRequests[1],runtime={s,list:()=>[{runId:'worker-one',parentSession:'lead',taskId}],schedule(){},state:()=>({phase:'running'})},req=(method,args)=>({method,args,parentSession:'lead',callerSession:'worker-one'});
 await assert.rejects(handleTeamDag(runtime,req('team_shutdown',{id:team.id,member:'two',requestId:peer.id,accept:true})),/does not own/);await assert.rejects(handleTeamDag(runtime,req('team_delete',{id:team.id})),/Lead-only/);await assert.rejects(handleTeamDag(runtime,req('team_shutdown',{id:team.id,member:'one'})),/does not own/);const result=await handleTeamDag(runtime,req('team_shutdown',{id:team.id,member:'one',requestId:own.id,accept:true}));assert.equal(result.members[0].status,'shutdown_approved');assert.equal(result.members[1].status,'active');assert.equal(result.shutdownRequests[1].status,'pending');
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});


test('worker mailbox persists immutable batches and waits for completion',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),dir=mkdtempSync(join(tmpdir(),'mail-delivery-'));let s=new Store(join(dir,'db'));
 try{
  let calls=0,assignment={runId:'worker',parentSession:'parent',status:'review'};
  const make=()=>Object.assign(Object.create(ScrumCoordinator.prototype),{s,list:()=>[assignment],state:()=>({phase:'running'}),reports:{isBusy:async()=>false},schedule(){},followup:async(id,message,requestId)=>{calls++;s.set('pi-send:'+requestId,{id,status:'accepted',message});return {status:'accepted'}}});
  s.set('scrumMailbox:worker',[{id:'one',message:'first',read:false}]);await make().deliverWorkerMail();const batch=s.setting('scrumMailDelivery:worker');assert.equal(calls,1);assert.equal(s.setting('scrumMailbox:worker')[0].read,false);
  s.set('scrumMailbox:worker',[...s.setting('scrumMailbox:worker'),{id:'two',message:'second',read:false}]);s.close();s=new Store(join(dir,'db'));assignment.status='running';await make().deliverWorkerMail();assert.equal(calls,1);assert.equal(s.setting('scrumMailDelivery:worker').message,'first');
  s.set('pi-send:'+batch.id,{status:'completed'});assignment.status='done';await make().deliverWorkerMail();assert.equal(s.setting('scrumMailbox:worker')[0].read,true);assert.equal(s.setting('scrumMailbox:worker')[1].read,false);assert.equal(s.setting('scrumMailDelivery:worker'),null);
  assignment.status='review';await make().deliverWorkerMail();const next=s.setting('scrumMailDelivery:worker');assert.equal(calls,2);assert.equal(next.message,'second');s.set('pi-send:'+next.id,{status:'uncertain'});await make().deliverWorkerMail();assert.equal(calls,2);assert.equal(s.setting('scrumMailbox:worker')[1].read,false);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});


test('mailbox causal retry and acknowledgment are scoped to the recipient',async()=>{
 const {taskApi}=await import('./task-api.mjs'),dir=mkdtempSync(join(tmpdir(),'mail-ack-')),s=new Store(join(dir,'db'));
 try{const runtime={s,list:()=>[{runId:'worker',parentSession:'lead'}],schedule(){}};
 const send=args=>taskApi(runtime,'team_send',args,'lead');const first=await send({to:'worker',message:'request',idempotency_key:'cause'});assert.deepEqual(await send({to:'worker',message:'request',idempotency_key:'cause'}),first);assert.equal(s.setting('scrumMailbox:worker').length,1);await assert.rejects(send({to:'worker',message:'changed',idempotency_key:'cause'}),/conflict/);
 await assert.rejects(taskApi(runtime,'team_messages',{ack_ids:[first.id]},'lead'),/this session/);assert.equal(s.setting('scrumMailbox:worker')[0].read,false);
 assert.deepEqual(await taskApi(runtime,'team_messages',{ack_ids:[first.id],unread:true},'lead','worker'),[]);await taskApi(runtime,'team_messages',{ack_ids:[first.id]},'lead','worker');assert.equal(s.setting('scrumMailbox:worker').length,1);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});


test('native session observations retain membership, deduplicate error mail and preserve stopped members',()=>{
 const dir=mkdtempSync(join(tmpdir(),'team-observe-')),s=new Store(join(dir,'db'));try{const teams=new TeamStore(s),team=teams.create({name:'Events',parentSession:'lead'});teams.member(team.id,'lead',{name:'worker',sessionId:'worker'});teams.observeSession('worker',{state:'running'});assert.equal(teams.get(team.id).members[0].executionStatus,'running');teams.observeSession('worker',{state:'errored',error:'failure'});teams.observeSession('worker',{state:'errored',error:'failure'});assert.equal(s.setting('scrumMailbox:lead').length,1);teams.observeSession('worker',{state:'unloaded'});assert.equal(teams.participant('worker').id,team.id);assert.throws(()=>teams.delete(team.id,'lead'),/Stop members/);teams.update(team.id,'lead',t=>{t.members[0].status='stopped'});teams.observeSession('worker',{state:'running'});assert.equal(teams.get(team.id).members[0].executionStatus,'unloaded');}finally{s.close();rmSync(dir,{recursive:true,force:true})}
});


test('confirmed parent deletion retries orphan cleanup, preserves history and excludes foreign resources',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),dir=mkdtempSync(join(tmpdir(),'team-orphan-')),s=new Store(join(dir,'db'));try{
 const teams=new TeamStore(s),team=teams.create({name:'Owner',parentSession:'lead'});teams.member(team.id,'lead',{name:'worker',sessionId:'worker'});const foreign=teams.create({name:'Foreign',parentSession:'other'});teams.member(foreign.id,'other',{name:'other',sessionId:'other-worker'});s.set('scrumMonitor:own',{parentSession:'lead',active:true});s.set('scrumMonitor:foreign',{parentSession:'other',active:true});
 let present=true,fail=true,stops=0;const assignment={id:'a',runId:'worker',parentSession:'lead',status:'running'};
 const runtime=Object.assign(Object.create(ScrumCoordinator.prototype),{s,pi:{sessionExists:async id=>id==='lead'?present:true},list:()=>[assignment],threads:{list:()=>[]},reports:{all:()=>[]},schedule(){},stop:async()=>{stops++;if(fail)throw Error('abort failed');assignment.status='cancelled'}});
 await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).status,'active');present=false;await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).status,'orphaned');assert.match(teams.get(team.id).cleanupError,/abort failed/);assert.equal(s.setting('scrumMonitor:own').active,true);fail=false;await runtime.reconcileTeamSessions();assert.equal(stops,2);assert.equal(teams.get(team.id).status,'deleted');assert.equal(teams.get(team.id).deletedReason,'parent-session-deleted');assert.equal(s.setting('scrumMonitor:own').active,false);assert.equal(s.setting('scrumMonitor:foreign').active,true);assert.equal(teams.get(foreign.id).status,'active');assert.equal(s.setting('ulw:lead').phase,'stopped');
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
test('unknown session and failed persistence probes never imply deletion',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),dir=mkdtempSync(join(tmpdir(),'team-probe-')),s=new Store(join(dir,'db'));try{const teams=new TeamStore(s),team=teams.create({name:'Unknown',parentSession:'lead'}),runtime=Object.assign(Object.create(ScrumCoordinator.prototype),{s,pi:{sessionExists:async()=>false},list:()=>[],reports:{all:()=>[]},schedule(){}});await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).status,'active');s.set('scrumSessionPresence:lead',{present:true});runtime.pi.sessionExists=async()=>{throw Error('disk unavailable')};await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).status,'active');assert.match(s.setting('scrumSessionProbeError:lead').error,/disk unavailable/);runtime.pi.sessionExists=async()=>null;await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).status,'active');
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});


test('deleted worker is not declared stopped until its live execution is aborted',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),dir=mkdtempSync(join(tmpdir(),'team-member-delete-')),s=new Store(join(dir,'db'));try{const teams=new TeamStore(s),team=teams.create({name:'Member',parentSession:'lead'});teams.member(team.id,'lead',{name:'worker',sessionId:'worker'});s.set('scrumSessionPresence:worker',{present:true});let fail=true;const assignment={id:'work',parentSession:'lead',runId:'worker',status:'running'},runtime=Object.assign(Object.create(ScrumCoordinator.prototype),{s,pi:{sessionExists:async id=>id==='lead'},list:()=>[assignment],threads:{list:()=>[]},reports:{all:()=>[]},schedule(){},stop:async()=>{if(fail)throw Error('still running');assignment.status='cancelled'}});await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).members[0].status,'active');assert.match(teams.get(team.id).members[0].cleanupError,/still running/);fail=false;await runtime.reconcileTeamSessions();assert.equal(teams.get(team.id).members[0].status,'stopped');assert.equal(teams.get(team.id).members[0].executionStatus,'deleted');await runtime.reconcileTeamSessions();assert.equal(s.setting('scrumMailbox:lead').filter(m=>m.kind==='member_deleted').length,1);assert.equal(teams.get(team.id).status,'active');}finally{s.close();rmSync(dir,{recursive:true,force:true})}
});

test('independent thread mailbox and shutdown remain in the owning parent scope',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),{ThreadStore}=await import('./thread.mjs'),{taskApi}=await import('./task-api.mjs'),{handleTeamDag}=await import('./dag.mjs'),dir=mkdtempSync(join(tmpdir(),'thread-mail-')),s=new Store(join(dir,'db'));try{
 let calls=0,status='pending';const adapter={create:async()=>({sessionId:'thread-worker'}),read:async()=>({status:'idle'}),send:async()=>{calls++;return {accepted:true}},receipt:async()=>({status})},threads=new ThreadStore(s,adapter),thread=await threads.handle({method:'thread_create',args:{name:'worker'},parentSession:'lead'}),runtime=Object.assign(Object.create(ScrumCoordinator.prototype),{s,threads,list:()=>[],schedule(){}});
 const mail=await taskApi(runtime,'team_send',{to:thread.sessionId,message:'work'},'lead');await runtime.deliverThreadMail();assert.equal(calls,1);assert.equal(s.setting('scrumMailbox:thread-worker')[0].read,false);await runtime.deliverThreadMail();assert.equal(calls,1);status='completed';await runtime.deliverThreadMail();assert.equal(s.setting('scrumMailbox:thread-worker')[0].read,true);assert.equal(s.setting('scrumMailbox:thread-worker')[0].id,mail.id);assert.equal(runtime.ownerOf(thread.sessionId).parentSession,'lead');
 await assert.rejects(taskApi(runtime,'team_send',{to:thread.sessionId,message:'foreign'},'other'),/この親/);const teams=new TeamStore(s),team=teams.create({name:'Thread team',parentSession:'lead'});teams.member(team.id,'lead',{name:'worker',sessionId:thread.sessionId});const request=teams.shutdown(team.id,'lead',{member:'worker'}).shutdownRequests[0];await handleTeamDag(runtime,{method:'team_shutdown',args:{id:team.id,member:'worker',requestId:request.id,accept:true},parentSession:'lead',callerSession:thread.sessionId});assert.equal(teams.get(team.id).members[0].status,'shutdown_approved');await assert.rejects(handleTeamDag(runtime,{method:'team_delete',args:{id:team.id},parentSession:'lead',callerSession:thread.sessionId}),/Lead-only/);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
test('parent deletion cleans assignments and workflow without requiring a Team',async()=>{
 const {ScrumCoordinator}=await import('./runtime.mjs'),dir=mkdtempSync(join(tmpdir(),'parent-no-team-')),s=new Store(join(dir,'db'));try{let present=true,stops=0;const assignment={id:'owned',parentSession:'lead',status:'running'},foreign={id:'foreign',parentSession:'other',status:'running'};s.set('scrumWorkflow:owned',{parentSession:'lead',status:'active'});s.set('scrumMonitor:owned',{parentSession:'lead',active:true});s.set('scrumMonitor:foreign',{parentSession:'other',active:true});const runtime=Object.assign(Object.create(ScrumCoordinator.prototype),{s,pi:{sessionExists:async id=>id==='lead'?present:true},list:()=>[assignment,foreign],threads:{list:()=>[]},reports:{all:()=>[]},schedule(){},stop:async id=>{assert.equal(id,'owned');stops++;assignment.status='cancelled'}});await runtime.reconcileTeamSessions();assert.equal(stops,0);present=false;await runtime.reconcileTeamSessions();assert.equal(stops,1);assert.equal(s.setting('scrumWorkflow:owned').status,'paused');assert.equal(s.setting('scrumMonitor:owned').active,false);assert.equal(s.setting('scrumMonitor:foreign').active,true);assert.equal(foreign.status,'running');assert.equal(s.setting('scrumParentCleanup:lead').status,'completed')}finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
