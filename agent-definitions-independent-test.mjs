import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,symlinkSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {loadAgentDefinitions} from './agent-definitions.mjs';
test('independent agent definitions preserve observed source priority and fixed model without accepting symlink escapes',()=>{
 const root=mkdtempSync(join(tmpdir(),'scrum-agent-loader-')),cwd=join(root,'project'),home=join(root,'home'),opencode=join(home,'.config/opencode');
 try{for(const dir of [join(cwd,'.opencode/agents'),join(home,'.claude/agents'),join(cwd,'.claude/agents'),join(opencode,'agents')])mkdirSync(dir,{recursive:true});
 const define=(dir,prompt)=>writeFileSync(join(dir,'worker.json'),JSON.stringify({name:'worker',prompt,model:'other-model',tools:{Read:true,Write:false}}));
 define(join(opencode,'agents'),'global OpenCode');define(join(cwd,'.opencode/agents'),'project OpenCode');define(join(home,'.claude/agents'),'user Claude');
 let definitions=loadAgentDefinitions({cwd,home,opencode});assert.equal(definitions.worker.instruction,'user Claude');assert.equal(definitions.worker.scope,'user');
 define(join(cwd,'.claude/agents'),'project Claude');definitions=loadAgentDefinitions({cwd,home,opencode});assert.equal(definitions.worker.instruction,'project Claude');assert.equal(definitions.worker.model,'gpt-6.1-sol');assert.equal(definitions.worker.reasoningEffort,'low');assert.equal(definitions.worker.requestedModel,'other-model');assert.equal(definitions.worker.readOnly,true);
 const outside=join(root,'outside.json');writeFileSync(outside,JSON.stringify({name:'escape',prompt:'Outside'}));symlinkSync(outside,join(cwd,'.claude/agents','escape.json'));const warnings=[];definitions=loadAgentDefinitions({cwd,home,opencode,warn:message=>warnings.push(message)});assert.equal(definitions.escape,undefined);assert(warnings.some(message=>message.includes('outside project')));assert.equal(Object.getPrototypeOf(definitions),null);
 }finally{rmSync(root,{recursive:true,force:true})}
});
