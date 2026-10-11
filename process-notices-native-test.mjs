import test from 'node:test';import assert from 'node:assert/strict';import {Session} from '@deepseek-ai/dsh-session';import {ProcessNotices} from './process-notices.mjs';import {writeFileSync,readFileSync,mkdtempSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';
test('native SDK session receipt replays after crash between conversation flush and acknowledgement',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'notice-native-')),file=join(dir,'session.json');let flushes=0;
 const ctx={sessions:{flush:async session=>{writeFileSync(file,JSON.stringify(session.snapshotEvents()),{mode:0o600});if(++flushes===2)throw Error('injected host crash after durable message')}}};
 const make=session=>({session,status:'idle',inbox:{nextStep:[],nextTurn:[]}}),session=Session.create('native-notice'),agent=make(session),first=new ProcessNotices(ctx);
 try{
  await assert.rejects(first.enqueue(agent,{id:'monitor-one',mode:'idle',records:[{text:'native monitor evidence'}]}),/injected host crash/);
  const durable=JSON.parse(readFileSync(file,'utf8'));assert.equal(durable.filter(e=>e.type==='user/message').length,1);assert.equal(durable.filter(e=>e.type==='scrum/process-notice-ack').length,0);
  const resumed=make(Session.create('native-notice',durable)),replay=new ProcessNotices(ctx);await replay.drain(resumed);await replay.drain(resumed);
  assert.equal(resumed.session.deriveMessages().length,1);assert.equal(replay.pending(resumed).length,0);assert.equal(resumed.session.snapshotEvents().filter(e=>e.type==='scrum/process-notice-ack').length,1);await replay.close();
 }finally{await first.close();rmSync(dir,{recursive:true,force:true})}
});
test('native receipt retry heals reservation flush failure without duplicate conversation messages',async()=>{
 let fail=true,flushed=0;const session=Session.create('flush-fault'),agent={session,status:'idle',inbox:{nextStep:[],nextTurn:[]}},ctx={sessions:{flush:async()=>{if(fail){fail=false;throw Error('storage unavailable')}flushed++}}},notices=new ProcessNotices(ctx);
 await assert.rejects(notices.enqueue(agent,{id:'flush-retry',mode:'idle',records:[]}),/storage unavailable/);assert.equal(notices.pending(agent).length,1);assert.equal(session.deriveMessages().length,0);await notices.enqueue(agent,{id:'flush-retry',mode:'idle',records:[]});await notices.drain(agent);assert.equal(notices.pending(agent).length,0);assert.equal(session.deriveMessages().length,1);assert(flushed>=2);await notices.close();
});
