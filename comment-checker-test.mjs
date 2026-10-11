import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {checkComments,commentHint} from './comment-checker.mjs';
const input=content=>({session_id:'comment-fixture',cwd:process.cwd(),tool_name:'write',transcript_path:'',hook_event_name:'PostToolUse',tool_input:{file_path:'fixture.ts',content}});
test('actual pinned comment binary detects new comments and accepts uncommented code',async()=>{
 const warning=await checkComments(input('// This function adds numbers\nexport const add=(a:number,b:number)=>a+b;'));
 assert.equal(warning.hasComments,true);assert.match(warning.message,/fixture.ts/);
 assert.deepEqual(await checkComments(input('export const add=(a:number,b:number)=>a+b;')),{hasComments:false,message:''});
 const hint=await commentHint({name:'hashline_edit',arguments:{file_path:'fixture.ts',edits:[{lines:['// explanatory comment','const n=1;']}]},agent:{session:{id:'fixture',header:{cwd:process.cwd()}}}},{isError:false});assert.match(hint,/fixture.ts/);
 assert.equal(await commentHint({name:'write',arguments:{file_path:'fixture.ts',content:'// comment'}},{isError:true}),null);
 assert.equal(await commentHint({name:'write',arguments:{file_path:'fixture.ts',content:'// comment'}},{isError:false},{enabled:false}),null);
 const custom=await checkComments(input('// comment\nconst n=1;'),{customPrompt:'CUSTOM_REVIEW_LITERAL_731'});assert.equal(custom.hasComments,true);assert.match(custom.message,/CUSTOM_REVIEW_LITERAL_731/);
 const patch=await commentHint({name:'apply_patch',arguments:{patch:'*** Begin Patch\n*** Add File: fixture.ts\n+// comment\n+const n=1;\n*** End Patch'},agent:{session:{id:'fixture',header:{cwd:process.cwd()}}}},{isError:false});assert.match(patch,/fixture.ts/);
});
test('checker timeout and early stdin close cannot orphan a child or crash the host',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'comment-checker-')),hang=join(dir,'hang'),early=join(dir,'early');
 try{
  await writeFile(hang,'#!/bin/sh\ntrap "" TERM\nwhile :; do :; done\n',{mode:0o700});
  const start=Date.now(),timeout=await checkComments(input('const n=1'),{binaryPath:hang,timeoutMs:100});assert.equal(timeout.incomplete,'timed out');assert(Date.now()-start<3000);
  await writeFile(early,'#!/bin/sh\nexit 2\n',{mode:0o700});const result=await checkComments(input('x'.repeat(100000)),{binaryPath:early,timeoutMs:1000});assert.equal(result.hasComments,false);
  const controller=new AbortController();controller.abort();assert.equal((await checkComments(input('const n=1'),{signal:controller.signal})).incomplete,'canceled');
 }finally{await rm(dir,{recursive:true,force:true})}
});
