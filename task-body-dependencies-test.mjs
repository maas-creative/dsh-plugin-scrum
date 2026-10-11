import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Store} from './ledger.mjs';import {taskApi} from './task-api.mjs';
test('task body aliases and dependency fanout persist atomically with scope, cycles and CAS',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'task-body-')),s=new Store(join(dir,'db'));try{
 const p=s.project({name:'Owned',status:'active'}),q=s.project({name:'Foreign',status:'active'});s.set('ulw:parent',{projectIds:[p]});const runtime={s,list:()=>[]};
 const a=await taskApi(runtime,'task_create',{projectId:p,title:'A',description:'raw\nbody',inputs:'preserved'},'parent');const b=await taskApi(runtime,'task_create',{projectId:p,title:'B',blockedBy:[a.id]},'parent');assert.equal(a.body,'raw\nbody');assert.deepEqual(b.dependencies,[a.id]);
 const c=await taskApi(runtime,'task_create',{projectId:p,title:'C',addBlocks:[b.id]},'parent');assert.deepEqual(s.snapshot().tasks.find(t=>t.id===b.id).dependencies,[a.id,c.id]);
 await assert.rejects(taskApi(runtime,'task_update',{id:a.id,version:a.version,addBlockedBy:[b.id],description:'bad'},'parent'),/循環/);assert.equal(s.snapshot().tasks.find(t=>t.id===a.id).body,'raw\nbody');
 await taskApi(runtime,'task_update',{id:a.id,version:a.version,title:'A2'},'parent');const current=s.snapshot().tasks.find(t=>t.id===a.id);assert.equal(current.body,'raw\nbody');assert.equal(current.inputs,'preserved');await assert.rejects(taskApi(runtime,'task_update',{id:a.id,version:a.version},'parent'),/版が変更/);
 const foreign=s.task({projectId:q,title:'Foreign',status:'todo',owner:'Pi'});await assert.rejects(taskApi(runtime,'task_update',{id:a.id,version:current.version,addBlocks:[foreign]},'parent'),/この計画/);
 }finally{s.db.close();rmSync(dir,{recursive:true,force:true})}
});
