import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {checkComments,extractApplyPatchEdits} from './independent/comment-inspection.mjs';
const input={tool_name:'write',tool_input:{file_path:'fixture.ts',content:'const x=1;'}};
async function fixture(t,body){const root=await mkdtemp(join(tmpdir(),'independent-comment-'));t.after(()=>rm(root,{recursive:true,force:true}));const file=join(root,'checker');await writeFile(file,'#!'+process.execPath+'\n'+body,{mode:0o700});return file;}
test('independent checker retains warning and failure stream contracts and literal prompt arguments',async t=>{
 const warning=await fixture(t,"process.stdin.resume();process.stdin.on('end',()=>{process.stderr.write(process.argv.slice(2).join('|')+'漢字');process.exitCode=2;});");
 const result=await checkComments(input,{binaryPath:warning,customPrompt:'$(never execute)'});assert.deepEqual(result,{hasComments:true,message:'--prompt|$(never execute)漢字'});
 const failed=await fixture(t,"process.stdin.resume();process.stdin.on('end',()=>{process.stdout.write('not a warning');process.stderr.write('checker failed');process.exitCode=1;});");assert.deepEqual(await checkComments(input,{binaryPath:failed}),{hasComments:false,message:'',failure:{exitCode:1,stderr:'checker failed'}});
});
test('independent checker caps output, rejects invalid input and does not hide missing executable',async t=>{
 const flood=await fixture(t,"process.stdout.write('x'.repeat(2*1024*1024));setInterval(()=>{},1000);");const result=await checkComments(input,{binaryPath:flood,timeoutMs:3000});assert.equal(result.incomplete,'Comment checker output exceeds 1 MiB');
 assert.equal((await checkComments(input,{binaryPath:'/nonexistent/scrum-checker'})).incomplete,'Comment checker binary unavailable');
 assert.equal((await checkComments(input,{binaryPath:flood,timeoutMs:0})).incomplete,'Invalid comment checker timeout');
 const circular={};circular.self=circular;assert.equal((await checkComments(circular,{binaryPath:flood})).incomplete,'Invalid comment checker input');
});
test('independent patch extraction matches captured public metadata and patch contracts',()=>{
 const cases=JSON.parse(readFileSync(new URL('./test-fixtures/comment-patch-public-facts.json',import.meta.url)));for(const row of cases)assert.deepEqual(extractApplyPatchEdits(row.meta,row.args),row.expected);
});
