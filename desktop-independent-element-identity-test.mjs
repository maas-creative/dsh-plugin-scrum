import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn,execFileSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {randomUUID} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {IndependentDesktopSessions} from './independent/desktop-sessions.mjs';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('native AX references survive fresh helper processes but refuse an indistinguishable replacement control',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-native-identity-')),binary=join(root,'fixture'),state=join(root,'state.json'),title=`Scrum identity ${randomUUID()}`,id=randomUUID(),sessions=new IndependentDesktopSessions();let fixture,exit;
 try{
  execFileSync('/usr/bin/xcrun',['swiftc',fileURLToPath(new URL('./test-fixtures/desktop-input.swift',import.meta.url)),'-o',binary],{timeout:30000,stdio:'pipe'});
  fixture=spawn(binary,[state,title],{stdio:'ignore'});exit=new Promise(resolve=>fixture.once('close',resolve));await sessions.open(id);
  let window;for(let i=0;i<100;i++){window=(await sessions.get(id).backend.windows()).find(row=>row.title===title);if(window)break;await pause(20)}assert(window,'Owned native fixture window exists');await pause(200);
  const find=`const [e]=await (await desktop.window(${JSON.stringify(window.id)})).find({identifier:'scrum-counter',limit:1});return e.ref;`;
  const original=(await sessions.run(id,find)).details.returnValue;
  assert.equal((await sessions.run(id,`return (await desktop.ref(${JSON.stringify(original)})).ref;`)).details.returnValue,original);
  fixture.kill('SIGUSR2');let replaced=false;for(let i=0;i<100;i++){try{if(JSON.parse(await readFile(state,'utf8')).replacements===1){replaced=true;break}}catch{}await pause(20)}assert(replaced);
  await assert.rejects(sessions.run(id,`return await desktop.ref(${JSON.stringify(original)});`),/Native desktop observation/);
  const fresh=(await sessions.run(id,find)).details.returnValue;
  const oldFingerprint=JSON.parse(Buffer.from(original.slice(9),'base64')).fingerprint,newFingerprint=JSON.parse(Buffer.from(fresh.slice(9),'base64')).fingerprint;
  const {nativeIdentity:oldIdentity,...oldFields}=oldFingerprint,{nativeIdentity:newIdentity,...newFields}=newFingerprint;
  assert.equal(typeof oldIdentity,'string');assert.notEqual(oldIdentity,newIdentity);assert.deepEqual(oldFields,newFields);
  assert.equal((await sessions.run(id,`return (await desktop.ref(${JSON.stringify(fresh)})).ref;`)).details.returnValue,fresh);
 }finally{
  await sessions.dispose();if(fixture){fixture.kill('SIGTERM');const timer=setTimeout(()=>fixture.kill('SIGKILL'),500);await exit;clearTimeout(timer)}await rm(root,{recursive:true,force:true});
 }
});
