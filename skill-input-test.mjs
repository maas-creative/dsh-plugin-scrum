import {hasLoadedSkill,forgetLoadedSkills} from './skill-load-state.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {resolveSkillInput} from './skill-input.mjs';
const available=['mass-ulw','ulw-loop','ulw-plan','ulw-research','ultimate-browsing'];
test('bare skill command preserves args and host command ownership; pointers compose and honor disables',()=>{
 assert.deepEqual(resolveSkillInput('/ulw-loop args',{available}).names,['ulw-loop']);assert.equal(resolveSkillInput('/ulw-loop args',{available}).text,'/skill:ulw-loop args');assert.equal(resolveSkillInput('/ulw-loop args',{available,hostCommands:['ulw-loop']}).text,'/ulw-loop args');assert.deepEqual(resolveSkillInput('mulw research',{available}).names,['mass-ulw','ulw-research','ultimate-browsing']);assert.deepEqual(resolveSkillInput('/skill:ulw-research test',{available}).names,['ulw-research','ultimate-browsing']);assert.deepEqual(resolveSkillInput('ulw research',{available,disabled:['ultimate-browsing']}).unavailable,['ultimate-browsing']);
});
test('quoted, relayed and extension text do not trigger skills or fabricate composite tokens',()=>{
 for(const text of ['`ulw-loop`','```\nulw research\n```','> mass ulw research','ulw `quoted` loop','<omo-ulw-loop-pointer>ulw-loop</omo-ulw-loop-pointer>'])assert.deepEqual(resolveSkillInput(text,{available}).names,[]);
 assert.deepEqual(resolveSkillInput('ulw-loop',{available,source:'extension'}).names,[]);assert.deepEqual(resolveSkillInput('ulw-loop <skill name="ulw-loop">body</skill>',{available}).names,[]);
});
import {registerSkillInputs} from './skill-input.mjs';
test('native command and assembly hooks load selected skill bodies with resource bases',async()=>{
 const handlers={},events={},definitions=Object.fromEntries(available.map(name=>[name,{name,description:name,content:'BODY '+name,invocation:{userInvocable:true},resourceBase:{kind:'directory',path:'/skills/'+name}}])),loaded=[];
 const ctx={skills:{list:async()=>Object.values(definitions),get:async name=>{loaded.push(name);return definitions[name]}},commands:{list:()=>[],register:command=>handlers[command.name]=command.handler},on:(name,handler)=>events[name]=handler};await registerSkillInputs(ctx);
 let message;const agent={session:{id:'test',header:{cwd:'/tmp'},snapshotEvents:()=>[{type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'mulw research'}]}}]},followup:value=>message=value};
 assert.equal((await handlers['ulw-loop']({agent,rawInput:'execute'})).kind,'success');assert.match(JSON.stringify(message),/BODY ulw-loop/);assert.match(JSON.stringify(message),/Resource base/);assert.equal(hasLoadedSkill(agent,'ulw-loop'),true);forgetLoadedSkills(agent);delete definitions['ulw-loop'];assert.equal((await handlers['ulw-loop']({agent,rawInput:''})).kind,'error');assert.equal(hasLoadedSkill(agent,'ulw-loop'),false);loaded.length=0;
 const assembled=await events['system-prompt/assemble']({}, {agent},async()=>({contexts:[]}));assert.equal(assembled.contexts.length,3);assert.equal(hasLoadedSkill(agent,'ulw-research'),true);assert.deepEqual(loaded,['mass-ulw','ulw-research','ultimate-browsing']);
});
