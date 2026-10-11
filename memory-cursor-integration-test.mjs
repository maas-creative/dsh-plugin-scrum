import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {initialReflectionState,captureCursorSnapshot,finalizeCursor} from './independent/memory-cursor.mjs';
import {createGitMemory} from './memory.mjs';
import {createMemoryJobs} from './memory-jobs.mjs';

test('reflection cursor consumes complete groups and failed verification never advances it',()=>{
 const entries=[{kind:'user',source_message_id:'one',text:'source'},{kind:'tool',source_message_id:'one',text:'evidence'},{kind:'assistant',source_message_id:'two',text:'result'}],state=initialReflectionState(),snapshot=captureCursorSnapshot(entries,state,{maxBytes:1});
 assert.equal(snapshot.entries.length,2);assert.equal(snapshot.backlog_remaining,1);
 assert.equal(finalizeCursor(state,entries,snapshot,false,'now').reflected_through_message_id,undefined);
 assert.throws(()=>finalizeCursor(state,entries,{end_snapshot_line:1,end_message_id:'one'},true,'now'),/complete message group/);
 const complete=finalizeCursor(state,entries,snapshot,true,'now');assert.equal(complete.reflected_through_message_id,'one');assert.equal(captureCursorSnapshot(entries,complete).entries[0].source_message_id,'two');assert.equal(state.reflected_through_message_id,undefined);
});
async function fixture(){const home=mkdtempSync(join(tmpdir(),'scrum-integration-proof-')),memory=createGitMemory({cwd:home,home});await memory.write({path:'reference/base',body:'base',source:'fixture'});const jobs=createMemoryJobs(memory),job=jobs.request({conversations:[{id:'c',entries:[{id:'m',role:'user',text:'new fact'}]}]}),proposal=await jobs.run({id:job.id,analyze:async()=>({summary:'new',changes:[{operation:'write',path:'reference/new',body:'new',source:'c#m',expectedHash:null}]})});return {home,memory,job,proposal,args:{sha:proposal.proposal,expectedBase:job.base,runId:job.id},git:args=>execFileSync('git',['-C',memory.directory,...args],{encoding:'utf8'}).trim()};}

test('legacy integration trailer remains recoverable without another merge',async()=>{
 const f=await fixture();try{
  await f.memory.integrateCommit(f.args);
  f.git(['-c','user.name=Test','-c','user.email=test@example.invalid','commit','--amend','--no-edit','-m',`legacy fixture\n\nOmo-Run: ${f.job.id}`]);
  const legacy=f.memory.head(),result=await f.memory.integrateCommit(f.args);assert.equal(result.integrationSha,legacy);assert.equal(f.memory.head(),legacy);
 }finally{rmSync(f.home,{recursive:true,force:true})}
});
test('pre-existing caller Git operation is preserved even with a clean index',async()=>{
 const f=await fixture();try{
  const path=join(f.memory.directory,f.git(['rev-parse','--git-path','MERGE_HEAD']));writeFileSync(path,f.job.base+'\n');
  const result=await f.memory.integrateCommit(f.args);assert.equal(result.outcome,'parent_dirty');assert.equal(f.memory.head(),f.job.base);assert.equal(readFileSync(path,'utf8'),f.job.base+'\n');
 }finally{rmSync(f.home,{recursive:true,force:true})}
});

test('completed integration ID cannot be reused for a different proposal',async()=>{
 const f=await fixture();try{
  await f.memory.integrateCommit(f.args);await f.memory.write({path:'reference/later',body:'user progress',source:'fixture'});
  const head=f.memory.head(),result=await f.memory.integrateCommit({...f.args,sha:head});assert.equal(result.outcome,'failed');assert.match(result.detail,/different proposal/);assert.equal(f.memory.head(),head);
 }finally{rmSync(f.home,{recursive:true,force:true})}
});
