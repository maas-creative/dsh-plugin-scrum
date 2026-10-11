import test from 'node:test';import assert from 'node:assert/strict';
import {computerAllowed} from './operation-tools.mjs';import {bindAgentRole} from './agent-role.mjs';import {rolePolicy} from './roles.mjs';
test('today parent can use OSS computer, planning children and read-only workers cannot',()=>{
 const root={session:{header:{}}},child={session:{header:{parentSession:'root'}}},reviewer={session:{header:{}}},executor={session:{header:{}}};
 bindAgentRole(root,'planner',rolePolicy('planner'));bindAgentRole(child,'planner',rolePolicy('planner'));bindAgentRole(reviewer,'reviewer',rolePolicy('reviewer'));bindAgentRole(executor,'executor',rolePolicy('executor'));
 assert.equal(computerAllowed(root),true);assert.equal(computerAllowed(child),false);bindAgentRole(child,'prometheus',rolePolicy('prometheus'));assert.equal(computerAllowed(child),false);assert.equal(computerAllowed(reviewer),false);assert.equal(computerAllowed(executor),true);assert(rolePolicy('planner').allow.includes('computer'));assert(rolePolicy('planner').allow.includes('computer_stop'));
});
