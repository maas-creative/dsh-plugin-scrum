import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {Store} from './ledger.mjs';import {resolveClaudeTaskStorage,importClaudeTasks} from './claude-tasks.mjs';
import {loadScrumConfiguration} from './configuration.mjs';
test('Claude storage priority follows upstream and config paths are resolved without model overrides',()=>{
 const cwd='/fixture/project';assert.equal(resolveClaudeTaskStorage({cwd,env:{HOME:'/home',ULTRAWORK_TASK_LIST_ID:' ulw / ',CLAUDE_CODE_TASK_LIST_ID:'claude'},config:{sisyphus:{tasks:{task_list_id:'configured'}}}}).listId,'ulw--');
 assert.equal(resolveClaudeTaskStorage({cwd,env:{HOME:'/home',CLAUDE_CODE_TASK_LIST_ID:'claude'}}).path,'/home/.config/opencode/tasks/claude');
 assert.equal(resolveClaudeTaskStorage({cwd,env:{},config:{sisyphus:{tasks:{storage_path:'./local'}}}}).path,'/fixture/project/local');
 const root=mkdtempSync(join(tmpdir(),'claude-config-'));try{mkdirSync(join(root,'.omo'));writeFileSync(join(root,'.omo','omo.json'),' {"sisyphus":{"tasks":{"storage_path":"tasks","task_list_id":"configured"}}}');const loaded=loadScrumConfiguration({cwd:root,env:{HOME:root}});assert.equal(loaded.config.sisyphus.tasks.storage_path,'tasks');assert.equal(loaded.diagnostics.length,0)}finally{rmSync(root,{recursive:true,force:true})}
});
test('Claude imports preserve source, dependencies, reviewed completion and durable idempotency; conflicts roll back',()=>{
 const root=mkdtempSync(join(tmpdir(),'claude-import-')),s=new Store(join(root,'db'));try{
 const path=join(root,'tasks');mkdirSync(path);const p=s.project({name:'Target',cwd:root}),other=s.project({name:'Other'}),config={sisyphus:{tasks:{storage_path:path}}};
 const write=(id,more={})=>writeFileSync(join(path,id+'.json'),JSON.stringify({id,subject:id,description:'work',status:'pending',blockedBy:[],...more}));write('1');write('2',{blockedBy:['1'],status:'completed'});const original=readFileSync(join(path,'2.json'),'utf8');
 const imported=importClaudeTasks(s,{cwd:root,config,projectId:p});assert.equal(imported.imported,2);const one=imported.mappings['1'].taskId,two=imported.mappings['2'].taskId;assert.deepEqual(s.snapshot().tasks.find(t=>t.id===two).dependencies,[one]);assert.equal(s.snapshot().tasks.find(t=>t.id===two).status,'reported');assert.equal(importClaudeTasks(s,{cwd:root,config,projectId:p}).imported,0);assert.equal(readFileSync(join(path,'2.json'),'utf8'),original);
 assert.throws(()=>importClaudeTasks(s,{cwd:root,config,projectId:other}),/another project/);
 write('1',{subject:'external update'});assert.throws(()=>importClaudeTasks(s,{cwd:root,config,projectId:p}),/source changed/);assert.equal(s.snapshot().tasks.find(t=>t.id===one).title,'1');write('1');write('3',{blockedBy:['missing']});assert.throws(()=>importClaudeTasks(s,{cwd:root,config,projectId:p}),/Missing/);assert.equal(s.snapshot().tasks.length,2);writeFileSync(join(path,'3.json'),'{');assert.throws(()=>importClaudeTasks(s,{cwd:root,config,projectId:p}),/Invalid Claude task JSON/);assert.equal(s.snapshot().tasks.length,2);
 }finally{s.close();rmSync(root,{recursive:true,force:true})}
});
test('explicit source reconciliation checks source revision and canonical version, preserves canonical status and source bytes',()=>{
 const root=mkdtempSync(join(tmpdir(),'claude-reconcile-')),s=new Store(join(root,'db'));try{
 const path=join(root,'tasks');mkdirSync(path);const source=join(path,'1.json'),write=subject=>writeFileSync(source,JSON.stringify({id:'1',subject,description:'work',status:'pending'})),projectId=s.project({name:'Target'}),config={sisyphus:{tasks:{storage_path:path}}};write('First');const first=importClaudeTasks(s,{cwd:root,projectId,config}),id=first.mappings['1'].taskId;write('Changed');let conflict;try{importClaudeTasks(s,{cwd:root,projectId,config})}catch(error){conflict=error}assert.equal(conflict.status,409);assert.ok(conflict.sourceRevision);const approval={sourceRevision:conflict.sourceRevision,canonicalVersion:conflict.canonicalVersion};assert.throws(()=>importClaudeTasks(s,{cwd:root,projectId,config,reconcile:{'1':{...approval,canonicalVersion:0}}}),/reconcile explicitly/);const before=readFileSync(source,'utf8');assert.equal(importClaudeTasks(s,{cwd:root,projectId,config,reconcile:{'1':approval}}).imported,1);assert.equal(s.snapshot().tasks.find(t=>t.id===id).title,'Changed');assert.equal(s.snapshot().tasks.find(t=>t.id===id).status,'todo');assert.equal(readFileSync(source,'utf8'),before);assert.equal(importClaudeTasks(s,{cwd:root,projectId,config}).imported,0);
 }finally{s.close();rmSync(root,{recursive:true,force:true})}
});
test('external write during transaction is detected and rolls back canonical import',()=>{
 const root=mkdtempSync(join(tmpdir(),'claude-concurrent-')),s=new Store(join(root,'db'));try{
 const path=join(root,'tasks');mkdirSync(path);const source=join(path,'1.json');writeFileSync(source,JSON.stringify({id:'1',subject:'First',description:'work',status:'pending'}));const projectId=s.project({name:'Target'}),original=s.task.bind(s);let changed=false;s.task=args=>{const id=original(args);if(!changed){changed=true;writeFileSync(source,JSON.stringify({id:'1',subject:'Concurrent',description:'work',status:'pending'}))}return id};assert.throws(()=>importClaudeTasks(s,{cwd:root,projectId,config:{sisyphus:{tasks:{storage_path:path}}}}),/changed during import/);assert.equal(s.snapshot().tasks.length,0);assert.match(readFileSync(source,'utf8'),/Concurrent/);
 }finally{s.close();rmSync(root,{recursive:true,force:true})}
});
