import test from 'node:test';import assert from 'node:assert/strict';import {ProcessMonitor} from './process-monitor.mjs';import {ProcessNotices} from './process-notices.mjs';
test('monitor retains split UTF8 lines in matched/unmatched rings with truthful drop counters',async()=>{
 const monitor=new ProcessMonitor({maxBytes:100,maxRecords:2}),batches=[];monitor.onBatch(batch=>batches.push(batch));try{
 assert.throws(()=>monitor.start({command:process.execPath,match_pattern:'(a+)+$'}),/unsafe/);
 const job=monitor.start({command:process.execPath,match_pattern:'^MATCH',mode:'idle',args:['-e',"process.stdout.write('MA');setTimeout(()=>{process.stdout.write('TCH 日本\\nMISS 1\\nMISS 2\\nMISS 3\\n');process.stderr.write('MATCH stderr\\n')},10)"]});await monitor.wait(job.id);await new Promise(r=>setImmediate(r));
 const matched=monitor.read(job.id,{stream:'matched'});assert.deepEqual(matched.lines.map(l=>l.text),['MATCH 日本','MATCH stderr']);const unmatched=monitor.read(job.id,{stream:'unmatched'});assert.deepEqual(unmatched.lines.map(l=>l.text),['MISS 2','MISS 3']);assert.equal(unmatched.counters.totalLines,5);assert.equal(unmatched.counters.matchedLines,2);assert.equal(unmatched.counters.droppedUnmatched,1);assert.ok(unmatched.counters.bytesDropped>0);assert.equal(monitor.read(job.id,{stream:'all',since_sequence:matched.lines[0].seq}).lines.some(l=>l.text==='MATCH 日本'),false);assert.equal(batches.flatMap(b=>b.lines).length,2);
 }finally{await monitor.dispose()}
});
test('idle notices survive reconstruction and live-safe uses next-step without acknowledging reception early',async()=>{
 const events=[],messages=[],sent=[],session={id:'parent',snapshotEvents:()=>events,deriveMessages:()=>messages,append(type,data){events.push({type,data});if(type==='user/message')messages.push(data)}};
 const agent={session,status:'running',inbox:{nextStep:[],nextTurn:[]},send(message,mode){assert.equal(mode,'next-step');sent.push(message);this.inbox.nextStep.push(message)}},ctx={sessions:{flush:async()=>{}}};
 const notices=new ProcessNotices(ctx);await notices.enqueue(agent,{id:'idle',batchSeq:1,mode:'idle',lines:[{text:'first'}]});assert.equal(sent.length,0);assert.equal(notices.pending(agent).length,1);
 await notices.enqueue(agent,{id:'live',batchSeq:1,mode:'live_safe',lines:[{text:'second'}]});assert.equal(sent.length,1);assert.equal(events.filter(e=>e.type==='scrum/process-notice-ack').length,0);
 messages.push(sent[0]);agent.inbox.nextStep=[];agent.status='idle';const recovered=new ProcessNotices(ctx);await recovered.drain(agent);assert.equal(recovered.pending(agent).length,0);assert.equal(messages.length,2);await recovered.drain(agent);assert.equal(messages.length,2);await notices.close();await recovered.close();
});
test('live delivery retries send failures and avoids an already queued notice after reconstruction',async()=>{
 const events=[],messages=[],session={id:'parent',snapshotEvents:()=>events,deriveMessages:()=>messages,append:(type,data)=>events.push({type,data})},ctx={sessions:{flush:async()=>{}}};let calls=0;
 const agent={session,status:'running',inbox:{nextStep:[],nextTurn:[]},send(message){calls++;if(calls===1)throw Error('injected send failure');this.inbox.nextStep.push(message)}};
 const notices=new ProcessNotices(ctx);await assert.rejects(notices.enqueue(agent,{id:'retry',mode:'live_safe'}),/injected/);await notices.drain(agent);assert.equal(calls,2);const replay=new ProcessNotices(ctx);await replay.drain(agent);assert.equal(calls,2);assert.equal(replay.pending(agent).length,1);messages.push(agent.inbox.nextStep[0]);agent.inbox.nextStep=[];await replay.drain(agent);assert.equal(replay.pending(agent).length,0);await replay.close();await replay.drain(agent);assert.equal(calls,2);await notices.close();
});
