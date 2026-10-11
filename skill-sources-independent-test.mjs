import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {skillsConfigSchema,configuredSkillRoots,configuredSkillDefinitions} from './skill-sources.mjs';

test('persisted skill definitions retain invocation metadata and reject invalid source types',()=>{
 const saved={sources:[{path:'custom',recursive:true,glob:'**/SKILL.md'}],enable:['research'],research:{description:'Read primary evidence',from:'custom/research/SKILL.md',model:'fixed-model',agent:'researcher',subtask:true,'argument-hint':'question',license:'MIT',compatibility:'DSH',metadata:{owner:'user'},'allowed-tools':['read'],disable:false}};
 const before=JSON.stringify(saved);
 assert.equal(skillsConfigSchema.safeParse(saved).success,true);
 assert.equal(skillsConfigSchema.safeParse({sources:[{path:17}]}).success,false);
 const [candidate]=configuredSkillDefinitions({skills:saved},'/fixture');
 assert.equal(candidate.name,'research');
 assert.equal(candidate.resourceBase.path,'/fixture/custom/research');
 assert.equal(candidate.configured.model,'fixed-model');
 assert.deepEqual(candidate.configured['allowed-tools'],['read']);
 assert.equal(JSON.stringify(saved),before);
});

test('custom recursive discovery excludes dependency and private directories and respects source glob',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'scrum-skill-source-'));
 try{
  for(const path of ['custom/research','custom/vendor/copied','custom/node_modules/dependency','custom/.git/private'])mkdirSync(join(cwd,path),{recursive:true});
  const discovery=configuredSkillRoots({skills:{sources:[{path:'custom',recursive:true,glob:'research/**'}]}},cwd);
  assert.deepEqual(discovery.roots,[join(cwd,'custom'),join(cwd,'custom/research')]);
  assert.equal(discovery.allows(join(cwd,'custom/research/SKILL.md')),true);
  assert.equal(discovery.allows(join(cwd,'custom/other/SKILL.md')),false);
  assert.equal(discovery.allows(join(cwd,'bundled/SKILL.md')),true);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});

test('disabled inline skills do not reappear as executable definitions',()=>{
 const config={skills:{sources:['custom'],enable:['keep'],disable:['other'],keep:{template:'Read only.'},off:{template:'Disabled.',disable:true},metadataOnly:{description:'Not executable'},legacy:false}};
 assert.deepEqual(configuredSkillDefinitions(config,'/fixture').map(x=>x.name),['keep']);
});
