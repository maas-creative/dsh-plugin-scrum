import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createGitMemory} from './memory.mjs';
import {createMemoryJobs,createFactsQueue} from './memory-jobs.mjs';
const home=mkdtempSync(join(tmpdir(),'scrum-memory-jobs-test-'));
try{
 const memory=createGitMemory({cwd:home,home});await memory.write({path:'system/fact',key:'fact',body:'before',source:'fixture'});
 const conversation={id:'conversation-1',entries:[{id:'m1',role:'user',text:'Remember that this project uses Node 24.'}]};
 const jobs=createMemoryJobs(memory);const request=jobs.request({kind:'reflection',conversations:[conversation]});
 const proposed=await jobs.run({id:request.id,analyze:async input=>{assert.equal(input.model,'gpt-6.1-sol');assert.equal(input.reasoningEffort,'low');return {summary:'remember Node version',changes:[{operation:'write',path:'reference/node',body:'Node 24',source:'conversation-1#m1',expectedHash:null}]}}});
 assert.equal(proposed.status,'proposed');assert.equal(memory.read({path:'reference/node'}),null);const applied=await jobs.apply({id:request.id});assert.equal(applied.status,'completed');assert.equal(memory.read({path:'reference/node'}).body,'Node 24');assert.equal((await jobs.apply({id:request.id})).status,'completed');
 const dream=jobs.request({kind:'dream',conversations:[conversation,{...conversation,id:'conversation-2'}]});await jobs.run({id:dream.id,analyze:async()=>({summary:'no new knowledge',changes:[]})});await jobs.apply({id:dream.id});
 assert.equal(jobs.request({kind:'dream',conversations:[conversation]}).status,'requested');assert.throws(()=>jobs.request({kind:'dream',conversations:[]}));assert.equal(jobs.request({kind:'dream',conversations:[],provenance:{origin:'pressure'}}).status,'requested');await assert.rejects(jobs.run({id:request.id,analyze:async()=>{},reasoningEffort:'high'}));
 const invalid=jobs.request({conversations:[conversation]});await assert.rejects(jobs.run({id:invalid.id,analyze:async()=>({summary:'stale',changes:[{operation:'write',path:'system/fact',body:'bad',source:'test',expectedHash:'wrong'}]})}));assert.equal(memory.read({path:'system/fact'}).body,'before');
 const parked=jobs.request({conversations:[conversation]});await jobs.run({id:parked.id,analyze:async()=>({summary:'proposal',changes:[{operation:'write',path:'reference/parked',body:'new',source:'test',expectedHash:null}]})});await memory.write({path:'reference/concurrent',body:'concurrent',source:'test'});await assert.rejects(jobs.apply({id:parked.id}));assert.equal(jobs.get(parked.id).status,'parked');
 const queue=createFactsQueue(memory);const queued=queue.enqueue({conversationId:conversation.id,entries:conversation.entries,source:'transcript.json'});assert.equal(queue.enqueue({conversationId:conversation.id,entries:conversation.entries,source:'transcript.json'}).enqueued,false);const facts=queue.request({jobs,id:queued.entry.id});await jobs.run({id:facts.id,analyze:async()=>({summary:'facts',changes:[]})});const complete=await jobs.apply({id:facts.id});queue.acknowledge({id:queued.entry.id,receipt:complete.receipt});assert.equal(queue.pending().length,0);assert.equal(queue.acknowledge({id:queued.entry.id,receipt:complete.receipt}).idempotent,true);assert.throws(()=>queue.enqueue({conversationId:conversation.id,entries:[{id:'m1',role:'user',text:'different'}],source:'transcript.json'}));
 const bundle=join(home,'backup.bundle');await memory.backup({destination:bundle});const restore=createGitMemory({cwd:join(home,'restore-project'),home});await restore.restore({bundle});assert.equal(restore.read({path:'reference/node'}).body,'Node 24');await assert.rejects(restore.restore({bundle}));
 writeFileSync(join(memory.directory,'reference/yaml.md'),'---\ndescription: YAML example\nsource: fixture\nverified: false\nread_only: false\naliases:\n  - one\n  - two\n---\n\nbody\n');assert.deepEqual(memory.read({path:'reference/yaml'}).metadata.aliases,['one','two']);
 console.log('Explicit reflection/dream/facts jobs, isolated proposals, stale hash/base rejection, durable queue checkpoints, YAML and backup restoration passed');
}finally{rmSync(home,{recursive:true,force:true})}
