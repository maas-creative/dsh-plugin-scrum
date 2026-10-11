import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {upstreamRoles,upstreamRolePrompt,roleAliases,scrumRoleContract} from './role-prompts.mjs';
test('independent role prompts retain persisted role identities and review boundaries',()=>{
 for(const id of ['sisyphus','atlas','hephaestus','multimodal-looker','omo-native-code-reviewer','omo-native-qa-executor','omo-native-gate-reviewer'])assert.ok(upstreamRolePrompt(id));
 assert.equal(upstreamRoles['omo-native-code-reviewer'].readOnly,true);
 assert.equal(upstreamRoles['omo-native-gate-reviewer'].readOnly,true);
 assert.equal(roleAliases.oracle,'architect');
 assert.match(scrumRoleContract,/scrum_review/);
 assert.match(scrumRoleContract,/low reasoning/);
 assert.doesNotMatch(readFileSync(new URL('./role-prompts.mjs',import.meta.url),'utf8'),/import .*vendor/);
});
