import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {Store} from './ledger.mjs';
import {createWorkpoolRuntime} from './workpool.mjs';
import {createWorkpoolStore} from './independent/workpool-store.mjs';

test('pool batch conflicts roll back atomically and parent stop suppresses delivery',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'pool-atomic-')),s=new Store(join(dir,'db'));let pools;const deliveries=[],created=[];
 try{pools=createWorkpoolRuntime({s,dir,threadAdapter:{create:async args=>{created.push(args);return {sessionId:'child',cwd:dir}},send:async()=>({accepted:true}),interrupt:async()=>({interrupted:true})}},{deliver:async(...args)=>deliveries.push(args),waitForIdle:async()=>{}});
 const request=args=>pools.handle({parentSession:'lead',args}),pool=await request({op:'create',name:'atomic',agent:{category:'general',prompt:'Verify'}});
 await assert.rejects(request({op:'push',pool_id:pool.pool_id,items:[{key:'a',input:1},{key:'a',input:2}]}),/different input/);assert.deepEqual(pools.pools.load(pool.pool_id).items,[]);
 await request({op:'push',pool_id:pool.pool_id,items:[{key:'b',input:3}]});await pools.stop('lead');await delay(20);assert.equal(created.length,0);assert.equal(deliveries.length,0);const stopped=pools.pools.load(pool.pool_id);assert.equal(stopped.items[0].status,'cancelled');assert.equal(stopped.aggregate.suppressed,true);assert.equal(stopped.aggregate.reason,'parent_stop');assert.equal(stopped.aggregate.delivered,false);
 }finally{await pools?.close();s.close();rmSync(dir,{recursive:true,force:true})}
});
test('read-only pool access rejects a symlinked storage directory',()=>{
 const dir=mkdtempSync(join(tmpdir(),'pool-directory-')),target=join(dir,'elsewhere');
 try{mkdirSync(target);symlinkSync(target,join(dir,'workpools'));const store=createWorkpoolStore(dir);assert.throws(()=>store.list(),/real directory/);assert.throws(()=>store.load('wp_'+'1'.repeat(32)),/real directory/);}finally{rmSync(dir,{recursive:true,force:true})}
});

test('separate writer processes preserve every committed pool mutation',async()=>{
 const {spawn}=await import('node:child_process'),dir=mkdtempSync(join(tmpdir(),'pool-writers-')),store=createWorkpoolStore(dir),id='wp_'+'2'.repeat(32);
 try{store.create({version:1,pool_id:id,parent_session_id:'lead',root_session_id:'lead',generation:1,revision:0,status:'open',mode:'fresh',items:[],workers:[]});
 const moduleUrl=new URL('./independent/workpool-store.mjs',import.meta.url).href;
 const run=index=>new Promise((resolve,reject)=>{const source=`import {createWorkpoolStore} from ${JSON.stringify(moduleUrl)};const store=createWorkpoolStore(${JSON.stringify(dir)});for(let n=0;n<12;n++)store.mutate(${JSON.stringify(id)},record=>({...record,items:[...record.items,{key:${JSON.stringify(String(index))}+'-'+n,item_id:${JSON.stringify(String(index))}+'-'+n,input:n,status:'queued'}]}));`;const child=spawn(process.execPath,['--input-type=module','-e',source],{stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(error)));});
 await Promise.all([run(0),run(1),run(2)]);const record=store.load(id);assert.equal(record.items.length,36);assert.equal(record.revision,36);assert.equal(new Set(record.items.map(item=>item.key)).size,36);
 }finally{rmSync(dir,{recursive:true,force:true})}
});

test('captured delivery acknowledgments reject changed queue entries and tolerate receipt recovery',async()=>{
 const {appendAssignedMessages,beginWorkerTurn,acknowledgeWorkerTurn}=await import('./independent/workpool-messages.mjs'),dir=mkdtempSync(join(tmpdir(),'pool-receipt-')),pools=createWorkpoolStore(dir),id='wp_'+'3'.repeat(32),turn={pool_id:id,generation:1,task_id:'st_12345678',run_epoch:0};
 let task={task_id:turn.task_id,pool_id:id,pool_generation:1,parent_session_id:'lead',notification:{run_epoch:0},pending_steering:[]};const tasks={load:()=>structuredClone(task),mutate:(_id,change)=>task=change(structuredClone(task))};
 try{pools.create({version:1,pool_id:id,parent_session_id:'lead',generation:1,revision:0,status:'open',mode:'fresh',items:[{key:'a',item_id:'wi_one',input:1,status:'assigned',binding:{task_id:turn.task_id,run_epoch:0,generation:1}}],workers:[]});const stores={pools,tasks};appendAssignedMessages(stores,turn);appendAssignedMessages(stores,turn);assert.equal(task.pending_steering.length,1);const captured=beginWorkerTurn(stores,turn);task.pending_steering[0].message+=' changed';assert.throws(()=>acknowledgeWorkerTurn(stores,turn,captured.entries),/entry changed/);assert.equal(pools.load(id).items[0].delivery,undefined);task.pending_steering=structuredClone(captured.entries);acknowledgeWorkerTurn(stores,turn,captured.entries);assert.equal(task.pending_steering.length,0);assert.equal(pools.load(id).items[0].delivery.phase,'acknowledged');assert.throws(()=>acknowledgeWorkerTurn(stores,turn,[{...captured.entries[0],message:'never delivered'}]),/matching delivery receipt/);acknowledgeWorkerTurn(stores,turn,captured.entries);assert.equal(beginWorkerTurn(stores,turn),null);pools.mutate(id,record=>({...record,generation:2}));assert.throws(()=>acknowledgeWorkerTurn(stores,turn,captured.entries),/identity changed/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
