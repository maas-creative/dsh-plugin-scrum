import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createNativeKibitzer,kibitzerBranch} from './kibitzer-host.mjs';
test('native branch preserves genuine conversation without rendering relays or memory receipts',()=>{
 const branch=kibitzerBranch([{type:'user/message',data:{source:{kind:'user'},content:'research'}},{type:'user/message',data:{source:{kind:'agent-message'},content:'relay instruction'}},{type:'scrum/memory-surfaced',data:{paths:['reference/a.md']}},{type:'assistant/message',data:{message:{content:'answer'}}}]);
 assert.equal(branch[0].message.role,'user');assert.equal(branch[1].message,undefined);assert.equal(branch[2].message,undefined);assert.equal(branch[3].message.role,'assistant');
});
test('native host runs upstream sidecar closures and hands accepted committed-memory nudge to delivery',async()=>{
 const locksDirectory=await mkdtemp(join(tmpdir(),'scrum-host-'));let delivered=[],starts=0,disposed=0,drained=false;
 const agent={session:{id:'parent',header:{cwd:locksDirectory},snapshotEvents:()=>[{type:'user/message',data:{source:{kind:'user'},content:'research'}}]}};
 const candidate={path:'reference/a.md',description:'Research constraint',excerpt:'deadline Friday'};
 const recall={forAgent:()=>'',inputForAgent:()=>({query:'research',candidates:[candidate]}),committedCorpus:()=>({revision:'rev',documents:[{path:candidate.path,description:candidate.description,body:candidate.excerpt}]})};
 const startChild=async({tools})=>{starts++;return {subscribe:()=>()=>{},waitForIdle:async()=>{const result=await tools.find(t=>t.name==='memory').execute('read',{operation:'read',path:candidate.path});assert.match(result.content[0].text,/deadline Friday/);await tools.find(t=>t.name==='nudge').execute('nudge',{path:candidate.path,hint:'The note records that the deadline is Friday.'});return {status:'completed',finalResponse:''}},followUp:async()=>{},steer:async()=>{},abort:async()=>{},dispose:()=>{disposed++}}};
 startChild.drain=async()=>{drained=true};
 const host=createNativeKibitzer({ctx:{},agent,recall,memory:{},settings:{max_items:3},locksDirectory,startChild,deliver:async nudges=>{delivered.push(...nudges)}});
 try {host.prompt('research');assert.equal((await host.offer()).action,'seeded');await host.whenIdle();assert.equal(starts,1);assert.equal(delivered.length,1);assert.equal(delivered[0].path,candidate.path);assert.equal((await host.offer()).reason,'no_new_candidate');}
 finally {await host.shutdown();await rm(locksDirectory,{recursive:true,force:true})}
 assert.equal(disposed,1);assert.equal(drained,true);assert.equal((await host.offer()).reason,'disposed');
});
