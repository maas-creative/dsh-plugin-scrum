import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from './ledger.mjs';
import {ScrumCoordinator} from './runtime.mjs';
import {serve,request} from './ipc.mjs';

test('external installer persists native models through master IPC; worker tokens and incompatible host catalogs cannot mutate settings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-installer-ipc-')),store=new Store(join(dir,'db'));
 const runtime=new ScrumCoordinator(store,dir,{}, {initRuntime(){}});
 let server;
 try{
  const custom={default:{provider:'custom',model:'existing',reasoningEffort:'low'},roles:{oracle:{provider:'custom',model:'oracle-existing',reasoningEffort:'low'}},tasks:{unchanged:{provider:'custom',model:'task-existing',reasoningEffort:'low'}}};
  store.set('workerModels',custom);
  server=await serve(join(dir,'ipc.sock'),input=>runtime.handle(input));
  const child=server.issue({parentSession:'lead',runId:'worker'}),args={catalog:[{provider:'openai-codex',models:[{id:'gpt-6.1-sol'}]}]};
  await assert.rejects(request(child.path,child.token,'installer_config',args,'forged-lead'),/担当から利用できない/);
  assert.deepEqual(store.setting('workerModels'),custom);
  assert.equal(store.all("SELECT key FROM settings WHERE key LIKE 'scrumInstallerBackup:%'").length,0);
  await assert.rejects(request(server.path,server.token,'installer_config',args),/owner session required/);
  store.set('workerModelCatalog',[{provider:'custom',models:[{id:'existing'}]}]);
  await assert.rejects(request(server.path,server.token,'installer_config',args,'lead'),/Host provider catalog/);
  assert.deepEqual(store.setting('workerModels'),custom);
  store.set('workerModelCatalog',args.catalog);
  const result=await request(server.path,server.token,'installer_config',args,'lead');
  assert.equal(result.persisted,true);
  const saved=store.setting('workerModels');
  assert.deepEqual(saved.default,custom.default);
  assert.deepEqual(saved.roles.oracle,custom.roles.oracle);
  assert.deepEqual(saved.tasks,custom.tasks);
  assert.equal(saved.roles.executor.model,'gpt-6.1-sol');
  assert.deepEqual(store.setting(result.backupKey).workerModels,custom);
 }finally{await server?.close();await runtime.close();store.close();await rm(dir,{recursive:true,force:true});}
});
