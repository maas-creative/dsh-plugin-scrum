import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {planLifecycleRepair,repairLifecycleFile,validateLifecycleLog} from './lifecycle-repair.mjs';
const notice=(text='[Scrum startup] fixture',source={kind:'runtime-context',provider:'scrum-lifecycle'})=>({type:'user/message',data:{role:'user',id:'notice',content:[{type:'text',text}],source},surfaceOp:'append'});
const fixture=({system=true,after=false}={})=>{
 const header={type:'session',version:4,id:'repair-fixture',createdAt:1,cwd:tmpdir(),isSeeded:false,delegationDepth:0};
 const events=[notice()];if(system)events.push({type:'turn/start',data:{turn:1}},{type:'step/start',data:{turn:1,step:1}},{type:'system/message',data:{turn:1,step:1,message:{role:'system',id:'policy',source:{kind:'system-prompt'},content:[{type:'text',text:'fixture'}]}},surfaceOp:'append'});
 if(after)events.push(notice('[Scrum startup] later'));
 return [header,...events.map((event,seq)=>({...event,seq,time:seq+1}))];
};
const text=rows=>rows.map(row=>JSON.stringify(row)).join('\n')+'\n';
test('actual SDK format rejects pre-system surface and accepts narrowly repaired record preserving seq and original',()=>{
 const rows=fixture({after:true});assert.throws(()=>validateLifecycleLog(rows),/protected first surface head/);
 const plan=planLifecycleRepair(text(rows)),repaired=plan.text.trimEnd().split('\n').map(JSON.parse);
 assert.deepEqual(plan.changes,[{seq:0,notice:'startup'}]);assert.deepEqual(repaired[1].data.originalEvent,rows[1]);assert.equal(repaired[1].seq,0);assert.equal(repaired[1].ignorable,true);assert.deepEqual(repaired.slice(2),rows.slice(2));validateLifecycleLog(repaired);
});
test('pre-system notice without a later system is repaired; human and foreign messages are never rewritten',()=>{
 const rows=fixture({system:false});rows.push({...notice('Actual human request',{kind:'user'}),seq:1,time:2});
 const repaired=planLifecycleRepair(text(rows)).text.trimEnd().split('\n').map(JSON.parse);assert.deepEqual(repaired[2],rows[2]);
 for(const source of [{kind:'user'},{kind:'runtime-context',provider:'foreign'}]){const foreign=fixture({system:false});foreign[1].data.source=source;assert.equal(planLifecycleRepair(text(foreign)).changes.length,0)}
 const ordinary=fixture({system:false});ordinary[1].data.content[0].text='Other runtime text';assert.equal(planLifecycleRepair(text(ordinary)).changes.length,0);
});
test('dry run is read-only; apply backs up exact bytes and is idempotent; unrelated corruption refuses replacement',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'lifecycle-repair-'));try{const file=join(dir,'session.v4.jsonl'),original=text(fixture());await writeFile(file,original);
 const dry=await repairLifecycleFile(file);assert.equal(dry.applied,false);assert.equal(await readFile(file,'utf8'),original);
 await assert.rejects(repairLifecycleFile(file,{apply:true,expectedSha256:'wrong'}),/hash changed/);
 const result=await repairLifecycleFile(file,{apply:true,expectedSha256:dry.sha256});assert(result.applied);assert.equal(await readFile(result.backup,'utf8'),original);assert.equal((await repairLifecycleFile(file,{apply:true})).applied,false);
 const bad=fixture();bad.push({type:'foreign/required',seq:99,time:1,data:{}});await writeFile(file,text(bad));await assert.rejects(repairLifecycleFile(file,{apply:true}));assert.equal(await readFile(file,'utf8'),text(bad));
 const alias=join(dir,'alias');await symlink(file,alias);await assert.rejects(repairLifecycleFile(alias,{apply:true}),/nonregular/);
 }finally{await rm(dir,{recursive:true,force:true})}
});
