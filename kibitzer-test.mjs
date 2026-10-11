import test from 'node:test';import assert from 'node:assert/strict';import {createAcceptedNudgeCooldown,decideWake,backoffDelayMs} from './independent/memory-advisor.mjs';
test('upstream Kibitzer admits fresh unsurfaced candidates and caps accepted nudges',()=>{
 let now=0;const cooldown=createAcceptedNudgeCooldown({now:()=>now}),input={candidates:[{path:'system/profile.md'},{path:'reference/a.md'},{path:'reference/b.md'}],offered:new Set(['reference/a.md']),surfaced:new Set(),maxItems:2,cooldown};
 assert.deepEqual(decideWake(input).candidates,[{path:'reference/b.md'}]);cooldown.charge();assert.equal(decideWake(input).wake,true);cooldown.charge();assert.equal(decideWake(input).reason,'cooldown');now=600001;assert.equal(decideWake(input).wake,true);assert.equal(decideWake({...input,surfaced:new Set(['reference/b.md'])}).reason,'no_new_candidate');assert.equal(decideWake({...input,maxItems:0}).reason,'max_items_zero');assert.equal(backoffDelayMs(0,()=>0),1000);assert.equal(backoffDelayMs(20,()=>1),300000);
});

import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createKibitzerSidecarTools,createWakeToolBudget,createKibitzerWakeSlot,KIBITZER_SIDECAR_TOOL_NAMES} from './independent/memory-advisor.mjs';
test('upstream scoped tools refuse traversal and symlink escape and enforce one shared wake budget',async(t)=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-kibitzer-'));
 try {
  await writeFile(join(root,'inside.txt'),'inside');
  const outside=await mkdtemp(join(tmpdir(),'scrum-outside-'));
  await writeFile(join(outside,'file.txt'),'external');
  await symlink(outside,join(root,'outside'));
  t.after(()=>rm(outside,{recursive:true,force:true}));
  const budget=createWakeToolBudget(3);
  const {tools}=createKibitzerSidecarTools({workspaceRoot:root,session:{entries:[]},memory:{repo:{}},nudge:{offered:new Set(),surfaced:new Set(),maxItems:3,accepted:()=>[]},budget:()=>budget});
  assert.deepEqual(tools.map(t=>t.name),KIBITZER_SIDECAR_TOOL_NAMES);
  const read=tools[0];
  assert.equal((await read.execute('1',{path:'inside.txt'})).content[0].text,'inside');
  assert.equal(JSON.parse((await read.execute('2',{path:'../outside.txt'})).content[0].text).rejected,'path_escape');
  assert.equal(JSON.parse((await read.execute('3',{path:'outside/file.txt'})).content[0].text).rejected,'path_escape');
  assert.equal(JSON.parse((await tools[2].execute('4',{})).content[0].text).rejected,'tool_budget_exceeded');
  assert.equal(budget.used,3);
 } finally {await rm(root,{recursive:true,force:true});}
});
test('upstream wake leases exclude another owner and release for reuse',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-wake-'));
 let first;
 try {
  const a=createKibitzerWakeSlot({locksDirectory:root,maxConcurrent:1,waitTimeoutMs:25,pollMs:5});
  const b=createKibitzerWakeSlot({locksDirectory:root,maxConcurrent:1,waitTimeoutMs:25,pollMs:5});
  first=await a.acquire();assert.equal(first.status,'acquired');
  assert.equal((await b.acquire()).status,'busy');
  assert.equal(await first.lease.release(),true);
  const next=await b.acquire();assert.equal(next.status,'acquired');await next.lease.release();
  const controller=new AbortController();controller.abort();
  assert.equal((await a.acquire(controller.signal)).status,'aborted');
 } finally {await first?.lease?.release();await rm(root,{recursive:true,force:true});}
});
