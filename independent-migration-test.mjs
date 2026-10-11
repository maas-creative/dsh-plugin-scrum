import test from 'node:test';import assert from 'node:assert/strict';
import {parsePlanChecklist} from './independent/plan-parser.mjs';
import {buildSkillMcpClientKey,withInjectedCdpEndpoint} from './independent/mcp-arguments.mjs';
import {scanSecretLikeMaterial,redactSecretLikeMaterial,redactUrl} from './independent/secret-filter.mjs';
test('plan parser excludes examples and preserves blocked work as incomplete',()=>{const content='## TODOs\n- [x] T1. Finished\n  - [ ] Detail\n```md\n- [x] T2. Example\n```\n## Final Verification Wave\n- [~] F1. Blocked\n';const result=parsePlanChecklist(content);assert.equal(result.total,2);assert.equal(result.completed,1);assert.equal(result.remaining,0);assert.notEqual(result.total,result.completed);});
test('MCP identities cannot collide at field separators and endpoint injection is immutable',()=>{assert.notEqual(buildSkillMcpClientKey({sessionID:'p',skillName:'a:b',serverName:'c'}),buildSkillMcpClientKey({sessionID:'p',skillName:'a',serverName:'b:c'}));const config={command:'node',args:['mcp.mjs','--cdp-endpoint','http://localhost:1']};const result=withInjectedCdpEndpoint(config,{cdpUrl:'http://localhost:2'});assert.deepEqual(config.args,['mcp.mjs','--cdp-endpoint','http://localhost:1']);assert.deepEqual(result.args,['mcp.mjs','--cdp-endpoint','http://localhost:2']);assert.throws(()=>withInjectedCdpEndpoint(config,{cdpUrl:'file:///tmp'}));assert.throws(()=>buildSkillMcpClientKey({}));});
test('credential filtering removes provider keys, JSON secrets and private key blocks',()=>{const secrets=['sk-proj-'+ 'a'.repeat(30),'ghp_'+ 'b'.repeat(35),'"refresh_token":"'+'c'.repeat(20)+'"','-----BEGIN PRIVATE KEY-----\nprivate\n-----END PRIVATE KEY-----'];for(const secret of secrets){assert(scanSecretLikeMaterial(secret).length);assert(redactSecretLikeMaterial(secret).includes('[REDACTED]'));assert(!JSON.stringify(scanSecretLikeMaterial(secret)).includes(secret));}const value=redactUrl('https://person:password@example.com/mcp?access_token=private&project=one');assert(!value.includes('private'));assert(!value.includes('password'));assert(value.includes('project=one'));});


test('identity policy notices match canonical policy files without matching unrelated names', async () => {
  const {touchesSoulPath, SOUL_PATHS} = await import('./independent/soul-paths.mjs');
  assert.equal(touchesSoulPath(['system/./persona.md']), true);
  assert.equal(touchesSoulPath(['system\\identity.md']), true);
  assert.equal(touchesSoulPath(['other/system/persona.md', 'system/persona.md.backup']), false);
  assert.equal(touchesSoulPath(null), false);
  assert.equal(Object.isFrozen(SOUL_PATHS), true);
});


test('filesystem memory policy fences sibling identities using path components',async()=>{
 const {registerMemoryFilesystemPolicy}=await import('./independent/memory-filesystem-policy.mjs');
 let policy;registerMemoryFilesystemPolicy({registerFilesystemPolicy:p=>policy=p},{identityPaths:{root:'/tmp/memory/own'},durableRoot:'/tmp/memory/own'});
 for(const operation of ['read','write','enumerate']){
   assert.equal(policy.check({operation,canonicalPath:'/tmp/memory/own/a.md'}).allow,true);
   assert.equal(policy.check({operation,canonicalPath:'/tmp/memory/own-other/a.md'}).allow,false);
   assert.equal(policy.check({operation,canonicalPath:'/tmp/memory/own/../other/a.md'}).allow,false);
   assert.equal(policy.check({operation,canonicalPath:'/tmp/memory'}).allow,false);
   assert.equal(policy.check({operation,canonicalPath:'/tmp/memory-copy/a.md'}).allow,true);
   assert.equal(policy.check({operation,canonicalPath:'relative.md'}).allow,false);
 }
});


test('memory reminders prioritize conflicts and reset deduplication after repair',async()=>{
 const {createRemindersState,generateReminders}=await import('./independent/memory-reminders.mjs');
 const state=createRemindersState();
 assert.equal(generateReminders(state,{dirtyPaths:['a.md'],conflictState:'merge'})[0].kind,'conflict');
 assert.deepEqual(generateReminders(state,{dirtyPaths:['a.md'],conflictState:'merge'}),[]);
 assert.equal(generateReminders(state,{dirtyPaths:['a.md'],conflictState:'none'})[0].kind,'dirty');
 assert.deepEqual(generateReminders(state,{dirtyPaths:[],conflictState:'none',aheadCount:5}),[]);
 assert.equal(generateReminders(state,{dirtyPaths:['a.md']})[0].kind,'dirty');
});
