import test from 'node:test';import assert from 'node:assert/strict';
import {promptSource,lowModel} from './prompt-origin.mjs';
test('scheduled planner traffic cannot impersonate human goal authority',()=>{
 for(const origin of [undefined,'scheduler','coordinator','worker'])assert.equal(promptSource({planner:true,origin},'parent').kind,'agent-message');
 assert.equal(promptSource({planner:true,origin:'human'},'parent').kind,'user');
 assert.equal(promptSource({planner:false},'worker').kind,'user');
 assert.throws(()=>promptSource({planner:true,origin:'user'},'parent'));
});
test('persisted and environment model settings enforce low at actual startup',()=>{
 assert.equal(lowModel().reasoningEffort,'low');assert.equal(lowModel({provider:'custom',model:'test'}).provider,'custom');
 assert.throws(()=>lowModel({reasoningEffort:'high'}));assert.throws(()=>lowModel({provider:''}));
});
