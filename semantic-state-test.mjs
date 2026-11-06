import test from 'node:test';
import assert from 'node:assert/strict';
import {sacRangeFor,semanticStateFromEvents} from './semantic-state.mjs';

test('semantic state keeps the task and records only observed action outcomes',()=>{
 const state=semanticStateFromEvents([
  {seq:1,type:'user/message',data:{message:{content:[{type:'text',text:'Inspect the ledger'}]}}},
  {seq:2,type:'tool/call',data:{name:'dashboard_read',callId:'c1'}},
  {seq:3,type:'tool/result',data:{name:'dashboard_read',message:{name:'dashboard_read'}}},
  {seq:4,type:'assistant/message',data:{message:{content:[{type:'text',text:'The ledger is loaded'}]}}},
  {seq:5,type:'step/end',data:{step:0}},
 ]);
 assert.equal(state.objective,'Inspect the ledger');
 assert.equal(state.completedSteps,1);
 assert.equal(state.lastAction.name,'dashboard_read');
 assert.equal(state.lastOutcome.kind,'assistant');
 assert.match(state.nextAction,/completed step 0/);
});

test('SAC range retains the semantic checkpoint and selects only the next completed action',()=>{
 const events=new Map([[1,{type:'system/message'}],[10,{type:'user/message'}],[11,{type:'assistant/message'}],[20,{type:'user/message'}],[21,{type:'assistant/message'}]]);
 const session={surface:{nodes:[1,10,11,20,21]},eventAt:seq=>events.get(seq)};
 assert.deepEqual(sacRangeFor(session,21,11),{start:20,end:21,startIdx:3,endIdx:4});
});
