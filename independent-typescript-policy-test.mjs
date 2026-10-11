import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {analyzeFile,discoverFiles} from './skills/programming/scripts/typescript/check-no-excuse-rules.ts';
test('TypeScript source policy diagnoses any without unstable AST API and preserves source',()=>{
 const directory=mkdtempSync(join(tmpdir(),'scrum-ts-policy-'));
 try {
  const file=join(directory,'fixture.ts');const body='// @ts-ignore\nconst x:any=y!;\n';writeFileSync(file,body);
  assert.deepEqual(analyzeFile(file).map(v=>[v.rule,v.line,v.col]),[['no-ts-ignore',1,1],['no-any-annotation',2,9],['no-non-null-assertion',2,13]]);
  assert.equal(readFileSync(file,'utf8'),body);
  writeFileSync(file,'const x="@ts-ignore";\n');assert.deepEqual(analyzeFile(file),[]);
  writeFileSync(join(directory,'types.d.ts'),'declare const x:any;');assert.deepEqual(discoverFiles([directory]),[file]);
  writeFileSync(file,'try{f()}catch(e:any){}');assert.deepEqual(analyzeFile(file).map(v=>v.rule),['empty-catch','no-any-annotation']);
  const r=spawnSync(process.execPath,['skills/programming/scripts/typescript/check-no-excuse-rules.ts',file],{cwd:new URL('.',import.meta.url),encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/\[empty-catch\]/);
  const missing=spawnSync(process.execPath,['skills/programming/scripts/typescript/check-no-excuse-rules.ts',join(directory,'missing.ts')],{cwd:new URL('.',import.meta.url),encoding:'utf8'});assert.equal(missing.status,2);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
