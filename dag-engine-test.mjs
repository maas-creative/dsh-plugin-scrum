import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createDagFileStore,createDagManager,compileDag} from './independent/dag-engine.mjs';
test('upstream DAG keeps idempotent definitions, ownership and restart history',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scrum-dag-engine-'));try{
 const store=createDagFileStore({project_dir:dir}),manager=createDagManager({store});
 const definition={key:'artifact-phase',name:'Artifact phase',nodes:[{id:'write',category:'general',prompt:'Produce the scoped artifact'},{id:'verify',category:'general',prompt:'Inspect the artifact independently',dependsOn:['write']}]};
 const start=await manager.start({definition,parentSessionId:'parent',rootSessionId:'parent'});const runId=start.snapshot.runId;assert.equal(start.reused,false);
 assert.equal((await manager.start({definition,parentSessionId:'parent',rootSessionId:'parent'})).reused,true);
 assert.throws(()=>manager.record(runId,'foreign'),error=>error.code==='run_not_owned');
 await assert.rejects(manager.start({definition:{...definition,nodes:[{...definition.nodes[0],prompt:'Changed'},definition.nodes[1]]},parentSessionId:'parent',rootSessionId:'parent'}),/definition/i);
 const restored=createDagManager({store:createDagFileStore({project_dir:dir})});assert.equal(restored.record(runId,'parent').definition.nodes.length,2);
 const amended=await restored.amend({runId,parentSessionId:'parent',definition:{...definition,name:'Revised name',nodes:[{...definition.nodes[0],prompt:'Corrected scope'},definition.nodes[1]]}});assert.equal(amended.definition.nodes[0].prompt,'Corrected scope');assert.ok(restored.history({runId,parentSessionId:'parent',limit:100}).events.length);
 const cycle=compileDag({...definition,nodes:[{...definition.nodes[0],dependsOn:['verify']},definition.nodes[1]]});assert.equal(cycle.ok,false);assert.ok(cycle.errors.some(error=>error.code==='cycle'));
 }finally{rmSync(dir,{recursive:true,force:true})}
});
