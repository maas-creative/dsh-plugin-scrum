import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {registerContext} from './context.mjs';

test('startup migration uses explicit fixture home without changing process HOME and preserves legacy backup',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-context-home-')),home=join(dir,'isolated-home'),cwd=join(dir,'project');
 const previousCwd=process.env.DSH_WORK_CWD,previousCache=process.env.SCRUM_CONFIG_CACHE_DIR,originalHome=process.env.HOME;
 try{
  await mkdir(join(home,'.config','opencode'),{recursive:true});await mkdir(cwd);
  const original='{"disabled_providers":["isolated-startup-fixture"]}';
  await writeFile(join(home,'.config','opencode','oh-my-openagent.json'),original);
  process.env.DSH_WORK_CWD=cwd;process.env.SCRUM_CONFIG_CACHE_DIR=join(dir,'config-cache');
  const commands=[],warnings=[],ctx={effect(){},on(){},tools:{schemas:()=>[]},systemPrompt:{context(){},section(){}},logger:{warn:message=>warnings.push(message)},commands:{list:()=>commands,register:command=>{commands.push(command)}}};
  registerContext(ctx,null,{migrationHomeDir:home});
  assert.equal(process.env.HOME,originalHome);
  assert(!warnings.some(message=>message.startsWith('Scrum configuration migration:')),warnings.join('\n'));
  const migrated=await readFile(join(home,'.omo','omo.jsonc'),'utf8');
  assert.match(migrated,/isolated-startup-fixture/);
  const backups=(await readdir(join(home,'.omo'))).filter(name=>name.startsWith('migration-backup-')&&name.endsWith('-opencode-config'));
  assert.equal(backups.length,1);
  assert.equal(await readFile(join(home,'.omo',backups[0],'.config','opencode','oh-my-openagent.json'),'utf8'),original);
  assert.throws(()=>registerContext({},null,{migrationHomeDir:'relative-home'}),/absolute path/);
 }finally{
  if(previousCwd===undefined)delete process.env.DSH_WORK_CWD;else process.env.DSH_WORK_CWD=previousCwd;
  if(previousCache===undefined)delete process.env.SCRUM_CONFIG_CACHE_DIR;else process.env.SCRUM_CONFIG_CACHE_DIR=previousCache;
  await rm(dir,{recursive:true,force:true});
 }
});
