import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {Store} from './ledger.mjs';import {handleUlwToolkit,ulwToolkitWorkflows} from './ulw-toolkit.mjs';
test('upstream ULW toolkit persists criteria and evidence with host-owned session binding',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scrum-ulw-sdk-')),s=new Store(join(dir,'db'));let state={};const runtime={s,state:()=>state};
 try{s.run('INSERT INTO runs VALUES(?,?,?,?,?,?,?,?,?,?,?)','parent','DSH','Parent',dir,'dsh:parent','history',1,1,null,'fixture','parent');
 const call=(operation,args={})=>handleUlwToolkit(runtime,{args:{operation,args},parentSession:'parent'});
 assert.equal((await call('help')).result.operations.length,10);
 assert.equal((await call('createGoals',{brief:'- Produce an artifact\n- Independently verify artifact'})).ok,true);
 const acquired=await call('completeGoals');assert.equal(acquired.ok,true);const goalId=acquired.result.goal.id;
 const criteria=await call('criteria',{goalId});assert.ok(criteria.result.criteria.length);
 for(const criterion of criteria.result.criteria)assert.equal((await call('recordEvidence',{goalId,criterionId:criterion.id,status:'pass',evidence:'Observed fixture output'})).ok,true);
 assert.equal((await call('checkpoint',{goalId,status:'complete',evidence:'Verified fixture output'})).ok,true);
 assert.equal(ulwToolkitWorkflows(s,'parent')[0].status,'active');
 s.set('scrumUlwToolkit:parent',{cwd:dir,sessionId:'parent',pending:true});assert.equal(ulwToolkitWorkflows(s,'parent')[0].status,'active');
 s.set('scrumUlwToolkit:parent',{cwd:dir,sessionId:'parent',plan:{aggregateCompletion:{status:'complete'}}});assert.equal(ulwToolkitWorkflows(s,'parent')[0].status,'active');
 assert.equal((await call('status')).result.plan.goals.find(g=>g.id===goalId).status,'complete');
 assert.equal((await call('completeGoals')).ok,true);
 await assert.rejects(call('status',{cwd:dir}),/binding/);
 await assert.rejects(handleUlwToolkit(runtime,{args:{operation:'status'},parentSession:'parent',callerSession:'worker'}),/lead-only/);
 state={phase:'stopped'};await assert.rejects(call('addGoal',{title:'Forbidden'}),/Stopped/);assert.equal((await call('status')).ok,true);
 }finally{s.close();rmSync(dir,{recursive:true,force:true})}
});
