import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {Store} from './ledger.mjs';import {callLookupAgent} from './call-agent.mjs';
test('lookup agents reuse only owned research roles and wait through native adapter',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'scrum-lookup-'));const store=new Store(join(dir,'data.sqlite'));let created=0,sent=0,waited=0;
 try{const runtime={s:store,threadCwd:()=>dir,threadAdapter:{create:async args=>{created++;assert.equal(args.subagent_type,'explore');return {sessionId:'lookup',cwd:dir}},send:async()=>{sent++;return {accepted:true}},waitForIdle:async()=>{waited++},read:async()=>({messages:[{text:'found'}]})}};
 const first=await callLookupAgent(runtime,{subagent_type:'explore',prompt:'Find the entry',run_in_background:true},'parent');assert.equal(first.queued,true);const second=await callLookupAgent(runtime,{subagent_type:'explore',prompt:'Find caller',session_id:first.session_id},'parent');assert.equal(second.queued,false);assert.equal(created,1);assert.equal(sent,2);assert.equal(waited,1);
 await assert.rejects(callLookupAgent(runtime,{subagent_type:'librarian',prompt:'Research',session_id:first.session_id},'parent'),/role/);await assert.rejects(callLookupAgent(runtime,{subagent_type:'explore',prompt:'Find',session_id:first.session_id},'peer'),/scope/);await assert.rejects(callLookupAgent(runtime,{subagent_type:'executor',prompt:'Write'},'parent'),/only explore/);
 }finally{store.close();rmSync(dir,{recursive:true,force:true})}
});

test('unavailable foreground wait does not create or send a lookup session',async()=>{
 let calls=0;await assert.rejects(callLookupAgent({threadAdapter:{create:async()=>calls++,send:async()=>calls++}},{subagent_type:'explore',prompt:'Find entry'},'parent'),/wait capability/);assert.equal(calls,0);
});
