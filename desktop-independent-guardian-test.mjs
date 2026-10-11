import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';import {randomUUID} from 'node:crypto';
import {runDesktopCommand} from './independent/desktop-peekaboo.mjs';import {loadNativeDesktopBuild} from './independent/desktop-build-loader.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function marker(path,nonce){for(let i=0;i<200;i++){try{const data=JSON.parse(await readFile(path,'utf8'));if(data.nonce===nonce)return data}catch{}await pause(10)}throw Error('Owned fixture did not start')}
test('native guardian preserves normal stdout and cancels an uncooperative command',async()=>{
 const {guardian:guardianExecutable}=await loadNativeDesktopBuild();
 assert.equal(await runDesktopCommand(process.execPath,['-e','process.stdout.write("fixture-ok")'],{guardianExecutable}),'fixture-ok');
 const before=Date.now();await assert.rejects(runDesktopCommand(process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},10)'],{guardianExecutable,timeoutMs:150}),/timed out/);assert(Date.now()-before<1500);
});
test('parent death reaps owned command descendants even when both ignore SIGTERM',async()=>{
 const {guardian:guardianExecutable}=await loadNativeDesktopBuild(),root=await mkdtemp(join(tmpdir(),'scrum-guardian-death-')),nonce=randomUUID(),childFile=join(root,'child.json'),grandFile=join(root,'grand.json');
 const beat=path=>`const fs=require('node:fs');process.on('SIGTERM',()=>{});let tick=0;setInterval(()=>fs.writeFileSync(${JSON.stringify(path)},JSON.stringify({pid:process.pid,nonce:${JSON.stringify(nonce)},tick:++tick})),30);`;
 const childSource=`require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(beat(grandFile))}],{stdio:'ignore'}).unref();${beat(childFile)}`;
 const parentSource=`import {runDesktopCommand} from ${JSON.stringify(new URL('./independent/desktop-peekaboo.mjs',import.meta.url).href)};await runDesktopCommand(process.execPath,['-e',${JSON.stringify(childSource)}],{guardianExecutable:${JSON.stringify(guardianExecutable)}});`;
 const parent=spawn(process.execPath,['--input-type=module','-e',parentSource],{stdio:'ignore'}),exit=new Promise(resolve=>parent.once('close',resolve));let child;
 try{
  child=await marker(childFile,nonce);await marker(grandFile,nonce);parent.kill('SIGKILL');await exit;await pause(400);
  const beforeChild=await marker(childFile,nonce),beforeGrand=await marker(grandFile,nonce);await pause(120);
  assert.equal((await marker(childFile,nonce)).tick,beforeChild.tick);assert.equal((await marker(grandFile,nonce)).tick,beforeGrand.tick);
 }finally{parent.kill('SIGKILL');if(child)try{process.kill(-child.pid,'SIGKILL')}catch{}await exit;await rm(root,{recursive:true,force:true})}
});
test('normal command exit also stops its remaining descendants',async()=>{
 const {guardian:guardianExecutable}=await loadNativeDesktopBuild(),root=await mkdtemp(join(tmpdir(),'scrum-guardian-normal-')),nonce=randomUUID(),file=join(root,'grand.json');let grand;
 const grandSource=`const fs=require('node:fs');let tick=0;setInterval(()=>fs.writeFileSync(${JSON.stringify(file)},JSON.stringify({pid:process.pid,nonce:${JSON.stringify(nonce)},tick:++tick})),30);`;
 const childSource=`const fs=require('node:fs');require('node:child_process').spawn(process.execPath,['-e',${JSON.stringify(grandSource)}],{stdio:'ignore'}).unref();setInterval(()=>{if(fs.existsSync(${JSON.stringify(file)}))process.exit(0)},10);`;
 try{
  await runDesktopCommand(process.execPath,['-e',childSource],{guardianExecutable});grand=await marker(file,nonce);await pause(120);assert.equal((await marker(file,nonce)).tick,grand.tick);
 }finally{if(grand)try{process.kill(grand.pid,'SIGKILL')}catch{}await rm(root,{recursive:true,force:true})}
});
