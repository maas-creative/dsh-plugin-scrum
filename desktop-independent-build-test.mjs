import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
test('independent desktop helpers build from shipped source and expose real native stop',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-native-build-'));
 try{
  const result=JSON.parse(execFileSync(process.execPath,[fileURLToPath(new URL('./desktop-build.mjs',import.meta.url)),root],{encoding:'utf8',timeout:120000}));
  const pointer=JSON.parse(await readFile(join(root,'current.json'),'utf8'));assert.equal(pointer.generation,result.buildKey);
  const manifest=JSON.parse(await readFile(join(root,pointer.generation,'provenance.json'),'utf8'));
  for(const [name,path]of Object.entries(manifest.preferredSources)){
   assert.equal(sha(await readFile(new URL(path,import.meta.url))),manifest.sourceSha256[name]);
   assert.equal(sha(await readFile(join(root,pointer.generation,`native-${name}`))),manifest.binarySha256[name]);
  }
  const stopRows=execFileSync(join(root,pointer.generation,'native-stop'),['--self-test'],{encoding:'utf8',timeout:10000}).trim().split('\n').map(line=>JSON.parse(line));assert(stopRows.some(row=>row.globalLive&&row.suspended&&row.reason==='ctrl+alt+cmd+escape'));
  const permissions=JSON.parse(execFileSync(join(root,pointer.generation,'native-observe'),['permissions'],{encoding:'utf8',timeout:10000}));assert.equal(typeof permissions.ax,'boolean');assert.equal(typeof permissions.capture,'boolean');assert.equal(typeof permissions.input,'boolean');
  assert(!(await readdir(root)).some(name=>name.startsWith('.stage-')));
 }finally{await rm(root,{recursive:true,force:true})}
});
