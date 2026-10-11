import test from 'node:test';
import assert from 'node:assert/strict';
import {BasicCompactionEngine} from '@deepseek-ai/dsh-compaction-basic';
import ScrumCompactionEngine from './compaction-hooks.mjs';
import {compactionState} from './compaction-state.mjs';
test('failed compaction releases continuation guard and next compaction succeeds',async()=>{
 const original=BasicCompactionEngine.prototype.summarize;
 const engine=Object.create(ScrumCompactionEngine.prototype);engine.ctx={};engine.triggers=new WeakMap();
 const agent={session:{id:'compaction-failure-fixture',header:{cwd:process.cwd()}}},failure=Error('provider failed during summary');
 try{
  BasicCompactionEngine.prototype.summarize=async()=>{assert.equal(compactionState(agent).active,true);throw failure};
  await assert.rejects(engine.summarize({messages:[]},agent,new AbortController().signal),error=>error===failure);
  assert.equal(compactionState(agent).active,false);assert.equal(compactionState(agent).acknowledgedEpoch,1);
  BasicCompactionEngine.prototype.summarize=async()=>({summary:'recovered'});
  assert.deepEqual(await engine.summarize({messages:[]},agent,new AbortController().signal),{summary:'recovered'});
  assert.equal(compactionState(agent).active,false);assert.equal(compactionState(agent).acknowledgedEpoch,2);
 }finally{BasicCompactionEngine.prototype.summarize=original}
});
