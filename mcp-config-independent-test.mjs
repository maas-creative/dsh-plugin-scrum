import test from 'node:test';import assert from 'node:assert/strict';import {expandMcpEnvironment,loadMcpConfiguration} from './mcp-config.mjs';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('independent MCP environment expansion never imports an unapproved token and preserves fallback and empty-value contracts',()=>{
 const env={HOME:'',PRIVATE_TOKEN:'must-not-appear',APPROVED:'allowed'};
 const value=expandMcpEnvironment({args:['${HOME:-fallback}','${PRIVATE_TOKEN}','${PRIVATE_TOKEN:-fallback}','${APPROVED}','${HOME-default}'],nested:{count:1}},{env,allowedEnvVars:['APPROVED']});
 assert.deepEqual(value,{args:['','','fallback','allowed',''],nested:{count:1}});assert(!JSON.stringify(value).includes(env.PRIVATE_TOKEN));
});
test('independent MCP inheritance requires explicit opt-in and excludes sibling project scopes',()=>{
 const root=mkdtempSync(join(tmpdir(),'scrum-mcp-independent-')),home=join(root,'home'),cwd=join(root,'project'),directory=join(root,'config');
 try{for(const path of [home,cwd,directory])mkdirSync(path);writeFileSync(join(home,'.claude.json'),JSON.stringify({mcpServers:{private:{command:'fixture'},sibling:{scope:'local',projectPath:join(root,'project-other'),command:'outside'}}}));assert.deepEqual(loadMcpConfiguration({homeDir:home,cwd,directory,includeBuiltins:false}),{});writeFileSync(join(directory,'mcp.json'),JSON.stringify({claudeCode:{enabled:true},mcpServers:{}}));const servers=loadMcpConfiguration({homeDir:home,cwd,directory,includeBuiltins:false});assert.equal(servers.private.command,'fixture');assert.equal(servers.sibling,undefined)}finally{rmSync(root,{recursive:true,force:true})}
});
