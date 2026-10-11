import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,rm,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';
import {executeSearch,executeRewrite,executeScan} from './independent/ast-tools.mjs';
import {applyAstPreview} from './ast-edit.mjs';
const require=createRequire(import.meta.url),binary=join(require.resolve('@ast-grep/cli/package.json'),'..','sg');
async function fixture(fn){const cwd=await mkdtemp(join(tmpdir(),'scrum-independent-ast-'));try{await fn(cwd);}finally{await rm(cwd,{recursive:true,force:true});}}
test('independent AST actual search, rewrite and YAML scan preserve Unicode offsets without writing',()=>fixture(async cwd=>{
 const source='const 日本語 = 1;\nconsole.log(日本語);\n';await writeFile(join(cwd,'a.js'),source);const input={workdir:cwd,paths:['a.js'],pattern:'console.log($A)',language:'javascript'};
 const search=await executeSearch(input,binary);assert.equal(search.ok,true,JSON.stringify(search));assert.equal(search.matches[0].metavariables.single.A,'日本語');assert.equal(search.matches[0].range.start.line,2);assert.equal(search.matches[0].range.start.byteOffset,21);
 const rewrite=await executeRewrite({...input,rewrite:'console.info($A)'},binary);assert.equal(rewrite.matches[0].replacement,'console.info(日本語)');assert.equal(await readFile(join(cwd,'a.js'),'utf8'),source);
 const rule='id: console-call\nlanguage: JavaScript\nrule:\n  pattern: console.log($A)\nfix: console.info($A)\n';
 const scan=await executeScan({workdir:cwd,paths:['a.js'],inlineRules:rule},binary);assert.equal(scan.ok,true,JSON.stringify(scan));assert.equal(scan.matches.length,1);assert.equal(scan.matches[0].ruleId,'console-call');assert.equal(scan.matches[0].replacement,'console.info(日本語)');
 await writeFile(join(cwd,'rule.yml'),rule);const disk=await executeScan({workdir:cwd,paths:['a.js'],ruleFile:'rule.yml'},binary);assert.deepEqual(disk.matches,scan.matches);
 assert.equal((await executeSearch({...input,pattern:'absent()'},binary)).matches.length,0);
}));
test('independent AST bounds previews, counts all files, rejects truncated application and invalid scope',()=>fixture(async cwd=>{
 for(const name of ['a.js','b.js'])await writeFile(join(cwd,name),'console.log(1);\n');const input={workdir:cwd,paths:['a.js','b.js'],pattern:'console.log($A)',language:'javascript'};
 const search=await executeSearch({...input,maxMatches:1},binary);assert.equal(search.ok,true);assert.equal(search.counts.returnedMatches,1);assert.equal(search.counts.totalFiles,2);assert.equal(search.truncation.reason,'match_limit');
 const rewrite=await executeRewrite({...input,maxMatches:1,rewrite:'console.info($A)'},binary);await assert.rejects(applyAstPreview({},rewrite,{},cwd),/complete successful/);
 const tiny=await executeSearch({...input,maxPayloadBytes:10},binary);assert.equal(tiny.ok,true);assert.equal(tiny.truncation.reason,'payload_limit');assert.equal(tiny.matches.length,0);
 for(const extra of [{paths:['..']},{globs:'*.js'},{noIgnore:'hidden'},{apply:true},{followSymlinks:true},{maxMatches:0}])assert.equal((await executeSearch({...input,...extra},binary)).ok,false,JSON.stringify(extra));
}));
test('independent AST timeout and cancellation terminate the running executable',()=>fixture(async cwd=>{
 await writeFile(join(cwd,'a.js'),'x');const fake=join(cwd,'slow');await writeFile(fake,'#!/bin/sh\nexec sleep 30\n');await chmod(fake,0o700);const input={workdir:cwd,paths:['a.js'],pattern:'x',language:'javascript'};
 const started=Date.now();const timed=await executeSearch({...input,timeoutMs:30},fake);assert.equal(timed.ok,false);assert.match(timed.error.message,/timed out/);assert.ok(Date.now()-started<3000);
 const controller=new AbortController();const pending=executeSearch(input,fake,controller.signal);setTimeout(()=>controller.abort(new Error('test abort')),30);await assert.rejects(pending,/test abort/);
}));
