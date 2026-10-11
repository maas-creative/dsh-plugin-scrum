import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from './ledger.mjs';
import {createWorkpoolRuntime} from './workpool.mjs';
test('workpool aggregate resumes after restart and stop preserves other parents',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scrum-pool-recovery-')),s=new Store(join(dir,'db'));let pools;
 try{
  const interrupted=[],runtime={s,dir,threadAdapter:{create:async args=>({sessionId:args.name,cwd:dir}),send:async()=>({accepted:true}),interrupt:async t=>interrupted.push(t.sessionId)}};
  let deliveries=0;pools=createWorkpoolRuntime(runtime,{deliver:async()=>{deliveries++;throw Error('offline')},waitForIdle:async()=>{}});
  const request=(parentSession,args)=>pools.handle({parentSession,args});
  const owned=await request('parent',{op:'create',name:'Owned',agent:{category:'general',prompt:'work'}});
  const peer=await request('peer',{op:'create',name:'Peer',agent:{category:'general',prompt:'work'}});
  await request('parent',{op:'close',pool_id:owned.pool_id});await delay(10);assert.equal(deliveries,1);assert.equal(pools.pools.load(owned.pool_id).aggregate.delivered,false);
  await pools.close();
  pools=createWorkpoolRuntime(runtime,{deliver:async()=>deliveries++,waitForIdle:async()=>{}});
  await request('parent',{op:'inspect',pool_id:owned.pool_id});await delay(10);assert.equal(deliveries,2);assert.equal(pools.pools.load(owned.pool_id).aggregate.delivered,true);
  await pools.stop('parent');assert.equal(pools.pools.load(peer.pool_id).status,'open');assert.equal(pools.pools.load(owned.pool_id).status,'closing');
  await assert.rejects(request('parent',{op:'create',name:'Wrong model',agent:{category:'general',prompt:'work',model:'other-model'}}),/GPT 6.1/);
 }finally{await pools?.close();s.close();rmSync(dir,{recursive:true,force:true})}
});
test('upstream keyed workpool reuses worker, refuses stale/conflicting yields and delivers one aggregate',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scrum-workpool-')),s=new Store(join(dir,'db'));let poolRuntime;
 try{
  let created=0,sends=0;const idle=new Map(),messages=[];
  const runtime={s,dir,threadAdapter:{create:async()=>({sessionId:'worker-'+(++created),cwd:dir}),send:async()=>{sends++;return {accepted:true}},interrupt:async()=>({interrupted:true})}};
  poolRuntime=createWorkpoolRuntime(runtime,{waitForIdle:id=>new Promise(resolve=>idle.set(id,resolve)),deliver:async(parent,message)=>messages.push({parent,message})});
  const lead=args=>poolRuntime.handle({parentSession:'parent',args});
  const pool=await lead({op:'create',name:'Research',agent:{category:'general',prompt:'Verify each item'}});
  const first=await lead({op:'push',pool_id:pool.pool_id,items:[{key:'a',input:{n:1}}]});
  assert.deepEqual(await lead({op:'push',pool_id:pool.pool_id,items:[{key:'a',input:{n:1}}]}),first);
  await assert.rejects(lead({op:'push',pool_id:pool.pool_id,items:[{key:'a',input:{n:2}}]}),/different input/);
  for(let i=0;i<100&&!idle.size;i++)await delay(5);assert.equal(idle.size,1);
  const workerYield=results=>poolRuntime.handle({parentSession:'parent',callerSession:'worker-1',args:{op:'yield',results}});
  const result={key:'a',data:{verified:true}};
  assert.equal((await workerYield([result])).results[0].status,'accepted');
  assert.equal((await workerYield([result])).results[0].status,'duplicate');
  assert.equal((await workerYield([{key:'a',data:false}])).results[0].error.code,'yield_conflict');
  idle.get('worker-1')();await delay(10);idle.clear();
  await lead({op:'push',pool_id:pool.pool_id,items:[{key:'b',input:{n:2}}]});
  for(let i=0;i<100&&!idle.size;i++)await delay(5);assert.equal(created,1);assert.equal(sends,2);
  assert.equal((await workerYield([{key:'b',data:2}])).results[0].status,'accepted');
  await lead({op:'close',pool_id:pool.pool_id});idle.get('worker-1')();await delay(20);
  assert.equal(messages.length,1);assert.equal(messages[0].message.results.length,2);
  await lead({op:'inspect',pool_id:pool.pool_id});await delay(10);assert.equal(messages.length,1);
  await assert.rejects(poolRuntime.handle({parentSession:'other',args:{op:'inspect',pool_id:pool.pool_id}}),/owning parent/);
  await assert.rejects(workerYield([{key:'b',data:2}]).then(()=>lead({op:'push',pool_id:pool.pool_id,items:[]})),/no longer accepts/);
 }finally{await poolRuntime?.close();s.close();rmSync(dir,{recursive:true,force:true})}
});
