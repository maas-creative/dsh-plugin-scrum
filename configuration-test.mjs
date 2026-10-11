import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {loadScrumConfiguration,configurationAllows} from './configuration.mjs';
import {loadCommandTemplates} from './commands.mjs';
test('portable automatic update and all-tool retention booleans reload and reject invalid replacements',()=>{
 const root=mkdtempSync(join(tmpdir(),'scrum-portable-config-'));try{
  const home=join(root,'home'),cwd=join(home,'project');mkdirSync(join(cwd,'.omo'),{recursive:true});const path=join(cwd,'.omo/omo.json');
  writeFileSync(path,JSON.stringify({auto_update:false,experimental:{truncate_all_tool_outputs:true}}));
  const first=loadScrumConfiguration({cwd,env:{HOME:home}});assert.equal(first.diagnostics.length,0);assert.equal(first.config.auto_update,false);assert.equal(first.config.experimental.truncate_all_tool_outputs,true);
  writeFileSync(path,JSON.stringify({auto_update:true,experimental:{truncate_all_tool_outputs:false}}));
  const changed=loadScrumConfiguration({cwd,env:{HOME:home}});assert.equal(changed.config.auto_update,true);assert.equal(changed.config.experimental.truncate_all_tool_outputs,false);
  writeFileSync(path,JSON.stringify({auto_update:'false',experimental:{truncate_all_tool_outputs:'true'}}));
  const invalid=loadScrumConfiguration({cwd,env:{HOME:home}});assert.equal(invalid.retainedLastValid,true);assert.equal(invalid.config.auto_update,true);assert.equal(invalid.config.experimental.truncate_all_tool_outputs,false);assert(invalid.diagnostics.some(d=>d.kind==='invalid-value'));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('pinned loader merges ancestor layers, JSONC, disable lists and observes edits',()=>{
 const root=mkdtempSync(join(tmpdir(),'scrum-config-'));try{
 const home=join(root,'home'),cwd=join(home,'project','nested');mkdirSync(cwd,{recursive:true});
 for(const dir of [home,join(home,'project'),cwd])mkdirSync(join(dir,'.omo'));
 writeFileSync(join(home,'.omo','omo.jsonc'),'{// user\n"disabled_commands":["hidden"],"disabled_skills":["one"]}');
 writeFileSync(join(home,'project','.omo','omo.json'),'{"disabled_skills":["two"]}');
 let loaded=loadScrumConfiguration({cwd,env:{HOME:home}});assert.equal(loaded.diagnostics.length,0);assert.equal(configurationAllows(loaded.config,'commands','hidden'),false);assert.equal(configurationAllows(loaded.config,'skills','two'),false);
 mkdirSync(join(cwd,'.scrum','commands'),{recursive:true});writeFileSync(join(cwd,'.scrum','commands','hidden.md'),'private');writeFileSync(join(cwd,'.scrum','commands','visible.md'),'public');
 assert.deepEqual(loadCommandTemplates({cwd,home}).map(c=>c.name),['visible']);
 writeFileSync(join(cwd,'.omo','omo.json'),'{"disabled_commands":["visible"]}');
 assert.equal(configurationAllows(loadScrumConfiguration({cwd,env:{HOME:home}}).config,'commands','visible'),false);
 writeFileSync(join(cwd,'.omo','omo.json'),'invalid');const invalid=loadScrumConfiguration({cwd,env:{HOME:home}});assert.ok(invalid.diagnostics.some(d=>d.kind==='parse'));assert.equal(invalid.retainedLastValid,true);assert.equal(configurationAllows(invalid.config,'commands','visible'),false);
 }finally{rmSync(root,{recursive:true,force:true})}
});

test('legacy migration resumes journal after interrupted target write and preserves source backup',async()=>{
 const {migrateScrumConfiguration}=await import('./configuration.mjs');const {readFileSync,readdirSync}=await import('node:fs');
 const root=mkdtempSync(join(tmpdir(),'scrum-migrate-'));try{
 const home=join(root,'home'),cwd=join(home,'project');mkdirSync(join(home,'.config','opencode'),{recursive:true});mkdirSync(cwd,{recursive:true});
 const source=join(home,'.config','opencode','oh-my-openagent.json'),original='{"disabled_providers":["migration-fixture"]}';writeFileSync(source,original);
 const crashed=migrateScrumConfiguration({cwd,env:{HOME:home},pid:900000,isProcessAlive:()=>false,onBoundary:boundary=>{if(boundary==='target-written')throw Error('injected crash')}});assert.match(crashed.error,/injected crash/);
 const resumed=migrateScrumConfiguration({cwd,env:{HOME:home},pid:900001,isProcessAlive:()=>false});assert.equal(resumed.error,undefined);assert.equal(resumed.journalResumed,true);
 const migrated=readFileSync(join(home,'.omo','omo.jsonc'),'utf8');assert.match(migrated,/migration-fixture/);assert.match(migrated,/opencode/);
 const backups=readdirSync(join(home,'.omo')).filter(name=>name.startsWith('migration-backup-')&&name.endsWith('-opencode-config'));assert.equal(backups.length,1);assert.equal(readFileSync(join(home,'.omo',backups[0],'.config','opencode','oh-my-openagent.json'),'utf8'),original);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('last-valid config survives cold restart, stays scoped and observes source deletion',async()=>{
 const {spawnSync}=await import('node:child_process');const {unlinkSync}=await import('node:fs');const root=mkdtempSync(join(tmpdir(),'scrum-config-cold-'));try{
 mkdirSync(join(root,'.omo'));const source=join(root,'.omo','omo.json');writeFileSync(source,'{"disabled_tools":["bash"],"hashline_edit":false}');assert.equal(loadScrumConfiguration({cwd:root,env:{HOME:root}}).config.hashline_edit,false);writeFileSync(source,'invalid');
 const code=`import {loadScrumConfiguration} from ${JSON.stringify(new URL('./configuration.mjs',import.meta.url).href)};console.log(JSON.stringify(loadScrumConfiguration({cwd:${JSON.stringify(root)},env:{HOME:${JSON.stringify(root)}}})));`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);const loaded=JSON.parse(result.stdout);assert.equal(loaded.retainedLastValid,true);assert.deepEqual(loaded.config.disabled_tools,['bash']);assert.equal(loaded.config.hashline_edit,false);assert.equal(loadScrumConfiguration({cwd:root,env:{HOME:root,OMO_PROFILE:'different'}}).retainedLastValid,false);unlinkSync(source);const removed=loadScrumConfiguration({cwd:root,env:{HOME:root}});assert.equal(removed.retainedLastValid,false);assert.equal(removed.config.disabled_tools,undefined);
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('configuration diagnosis and durable cache leave a Git workspace clean',async()=>{
 const {spawnSync}=await import('node:child_process');const root=mkdtempSync(join(tmpdir(),'scrum-config-git-'));try{
 const run=(...args)=>{const result=spawnSync('git',args,{cwd:root,encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout};run('init','-q');writeFileSync(join(root,'tracked.md'),'tracked');run('add','.');run('-c','user.name=Fixture','-c','user.email=fixture@example.invalid','commit','-qm','fixture');loadScrumConfiguration({cwd:root});assert.equal(run('status','--porcelain'),'');loadScrumConfiguration({cwd:root,env:{HOME:root,SCRUM_CONFIG_CACHE_DIR:join(root,'bad-cache')}});assert.equal(run('status','--porcelain'),'');
 }finally{rmSync(root,{recursive:true,force:true})}
});
test('portable tmux fields use pinned defaults and reject invalid changed values while retaining valid placement',()=>{
 const root=mkdtempSync(join(tmpdir(),'scrum-tmux-config-'));try{mkdirSync(join(root,'.omo'));const path=join(root,'.omo','omo.json');writeFileSync(path,'{"tmux":{"enabled":true,"layout":"tiled","isolation":"window"}}');let loaded=loadScrumConfiguration({cwd:root,env:{HOME:root}});assert.equal(loaded.config.tmux.enabled,true);assert.equal(loaded.config.tmux.layout,'tiled');assert.equal(loaded.config.tmux.isolation,'window');assert.equal(loaded.config.tmux.main_pane_size,60);assert.equal(loaded.config.tmux.agent_pane_min_width,40);writeFileSync(path,'{"tmux":{"enabled":true,"main_pane_size":90}}');loaded=loadScrumConfiguration({cwd:root,env:{HOME:root}});assert.equal(loaded.retainedLastValid,true);assert.equal(loaded.config.tmux.layout,'tiled');assert.ok(loaded.diagnostics.some(d=>d.kind==='invalid-value'));}finally{rmSync(root,{recursive:true,force:true})}
});
