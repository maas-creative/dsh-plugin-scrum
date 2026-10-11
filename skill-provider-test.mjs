import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {registerScrumSkills} from './skill-provider.mjs';
const candidatesOf=async(provider,options)=>{const observation=await provider.list(options);return Array.isArray(observation)?observation:observation.candidates};
test('Scrum skills use native resource bases and enforce changed disabled settings',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'scrum-skills-')),controller=new AbortController(),events={};let provider;
 try{await mkdir(join(cwd,'.omo','skills','fixture'),{recursive:true});await writeFile(join(cwd,'.omo','skills','fixture','SKILL.md'),'---\nname: fixture\ndescription: Local fixture\n---\nRead references/data.md.');
 const ctx={skills:{registerProvider:create=>provider=create({signal:controller.signal,invalidate(){}})},get(){},logger:{warn(){}},on:(name,fn)=>events[name]=fn};registerScrumSkills(ctx);
 let candidates=await candidatesOf(provider,{cwd}),candidate=candidates.find(s=>s.name==='fixture');assert.ok(candidate);const definition=await provider.get(candidate,{cwd});assert.equal(definition.resourceBase.path,join(cwd,'.omo','skills','fixture'));assert.match(definition.content,/references/);assert.ok(candidates.some(s=>s.name==='ulw-plan'));
 await writeFile(join(cwd,'.omo','omo.json'),'{"disabled_skills":["fixture"]}');assert.equal((await candidatesOf(provider,{cwd})).some(s=>s.name==='fixture'),false);await assert.rejects(provider.get(candidate,{cwd}),/disabled/);
 assert.equal((await events['tools/pre-execute']({name:'skill',arguments:{name:'fixture'},agent:{session:{header:{cwd}}}},async()=>({kind:'allow'}))).kind,'deny');
 }finally{controller.abort();await rm(cwd,{recursive:true,force:true})}
});
test('project outranks configured/user/builtin skills; recursive source edits and inline definitions reload',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'scrum-skill-sources-')),controller=new AbortController();let provider;
 try{
 const add=async(path,name,body)=>{await mkdir(path,{recursive:true});await writeFile(join(path,'SKILL.md'),'---\nname: '+name+'\ndescription: '+name+'\n---\n'+body)};
 await add(join(cwd,'.omo','skills','same'),'same','project');await add(join(cwd,'sources','nested','remote'),'remote','runtime source');await mkdir(join(cwd,'.omo'),{recursive:true});const config=join(cwd,'.omo','omo.json');await writeFile(config,JSON.stringify({skills:{sources:[{path:'sources',recursive:true,glob:'**/remote/**'}],same:{template:'config'},inline:{template:'inline'}}}));
 const ctx={skills:{registerProvider:create=>provider=create({signal:controller.signal,invalidate(){}})},get(){},logger:{warn(){}},on(){}};registerScrumSkills(ctx);let list=await candidatesOf(provider,{cwd});assert.equal(list.filter(s=>s.name==='same').length,1);assert.match((await provider.get(list.find(s=>s.name==='same'),{cwd})).content,/project/);assert.equal((await provider.get(list.find(s=>s.name==='inline'),{cwd})).content,'inline');assert.ok(list.some(s=>s.name==='remote'));
 await writeFile(config,JSON.stringify({skills:{sources:[],inline:{template:'changed'},disable:['same']}}));list=await candidatesOf(provider,{cwd});assert.ok(!list.some(s=>s.name==='same'||s.name==='remote'));assert.equal((await provider.get(list.find(s=>s.name==='inline'),{cwd})).content,'changed');
 }finally{controller.abort();await rm(cwd,{recursive:true,force:true})}
});
