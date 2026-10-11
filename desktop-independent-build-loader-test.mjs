import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {loadNativeDesktopBuild} from './independent/desktop-build-loader.mjs';
const digest=value=>createHash('sha256').update(value).digest('hex');
test('native loader rejects changed source, changed binary and symlinked generation files',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-loader-')),generation='a'.repeat(64),folder=join(root,generation);
 try{
  await mkdir(folder);const pointer={version:1,generation,buildKey:generation},manifest={version:1,buildKey:generation,target:`${process.arch==='x64'?'x86_64':process.arch}-apple-macosx15.0`,sourceSha256:{},binarySha256:{}};
  for(const [name,source]of [['stop','desktop-native-stop.swift'],['observe','desktop-observe.swift'],['guardian','desktop-command-guardian.swift']]){
   manifest.sourceSha256[name]=digest(await readFile(new URL(`./independent/${source}`,import.meta.url)));
   manifest.binarySha256[name]=digest(name);await writeFile(join(folder,`native-${name}`),name);
  }
  await writeFile(join(root,'current.json'),JSON.stringify(pointer));const manifestPath=join(folder,'provenance.json');await writeFile(manifestPath,JSON.stringify(manifest));
  assert.equal((await loadNativeDesktopBuild({root})).stop,join(folder,'native-stop'));
  await writeFile(join(folder,'native-stop'),'tampered');await assert.rejects(loadNativeDesktopBuild({root}),/digest mismatch/);await writeFile(join(folder,'native-stop'),'stop');
  manifest.sourceSha256.stop='b'.repeat(64);await writeFile(manifestPath,JSON.stringify(manifest));await assert.rejects(loadNativeDesktopBuild({root}),/source changed/);
  await rm(manifestPath);await writeFile(join(root,'other.json'),JSON.stringify(manifest));await symlink(join(root,'other.json'),manifestPath);await assert.rejects(loadNativeDesktopBuild({root}));
 }finally{await rm(root,{recursive:true,force:true})}
});
