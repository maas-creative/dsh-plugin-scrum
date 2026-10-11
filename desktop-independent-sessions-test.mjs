import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile,writeFile,symlink,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {IndependentDesktopSessions} from './independent/desktop-sessions.mjs';
class FakeStop {
 constructor(options){this.options=options;this.status={globalLive:true,suspended:false}}
 async open(){return this.status}
 assertLive(){if(this.closed||!this.status.globalLive||this.status.suspended)throw Error('Native stop unavailable')}
 async close(){this.closed=true;this.status={globalLive:false,suspended:true}}
}
function options(root,extra={}){
 return {path:join(root,'lease'),peekabooPath:'/fixture/peekaboo',observerPath:'/fixture/observe',stopPath:'/fixture/stop',stopFactory:value=>new FakeStop(value),backendFactory:value=>({capabilities:async()=>({backend:'quartz',capture:true,input:true}),click:async()=>{value.authorizeInput();return {accepted:true}}}),...extra};
}
test('independent session controller preserves ownership and requires explicit resume',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-desktop-session-')),id=randomUUID(),other=randomUUID();const sessions=new IndependentDesktopSessions(options(root,{runCode:async({backend,readOnly})=>({returnValue:readOnly?1:await backend.click(),displays:[]})}));
 try{await sessions.open(id);await sessions.open(other);await assert.rejects(sessions.run(id,'input',{readOnly:false}),/owner lease/);sessions.acquire(id);assert.throws(()=>sessions.acquire(other),/another session/);assert.equal((await sessions.run(id,'input',{readOnly:false})).details.returnValue.accepted,true);await sessions.emergencyAbort(id);assert.throws(()=>sessions.acquire(id),/human resume/);await assert.rejects(sessions.resume(id),/explicit human/);assert.equal((await sessions.run(id,'read')).details.returnValue,1);await sessions.resume(id,{humanRequested:true});sessions.acquire(id);sessions.release(id)}finally{await sessions.dispose();await rm(root,{recursive:true,force:true})}
});
test('emergency abort and close wait for native work cleanup before releasing lease',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-desktop-cleanup-')),id=randomUUID();let started,cleaned=false;const ready=new Promise(resolve=>{started=resolve});
 const sessions=new IndependentDesktopSessions(options(root,{runCode:async({signal})=>new Promise((_,reject)=>{started();signal.addEventListener('abort',()=>setTimeout(()=>{cleaned=true;reject(signal.reason)},40),{once:true})})}));
 try{await sessions.open(id);sessions.acquire(id);const run=sessions.run(id,'input',{readOnly:false});const rejected=assert.rejects(run,/emergency stop/);await ready;const stopping=sessions.emergencyAbort(id);assert.equal(sessions.lease.inspect().session,id);assert.throws(()=>sessions.release(id),/active input/);await stopping;await rejected;assert.equal(cleaned,true);assert.equal(sessions.lease.inspect(),null);await sessions.close(id)}finally{await sessions.dispose();await rm(root,{recursive:true,force:true})}
});
test('closing during startup cancels observed commands and waits for their cleanup',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-desktop-startup-')),id=randomUUID();let started,cleaned=false;const ready=new Promise(resolve=>{started=resolve});
 const sessions=new IndependentDesktopSessions(options(root,{backendFactory:()=>({capabilities:async(_,options)=>new Promise((_,reject)=>{started();options.signal.addEventListener('abort',()=>setTimeout(()=>{cleaned=true;reject(options.signal.reason)},30),{once:true})})})}));
 try{const opening=sessions.open(id);const rejected=assert.rejects(opening,/closed/);await ready;await sessions.close(id);await rejected;assert.equal(cleaned,true);assert.equal(sessions.sessions.has(id),false)}finally{await sessions.dispose();await rm(root,{recursive:true,force:true})}
});
test('session audit preserves previous records, excludes code and saves image artifacts',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-desktop-audit-')),id=randomUUID(),audit=join(root,'audit.jsonl');await writeFile(audit,'{"previous":true}\n');
 const bytes=Buffer.from('fixture image');const sessions=new IndependentDesktopSessions(options(root,{runCode:async()=>({returnValue:1,displays:[{type:'image',mimeType:'image/png',data:bytes.toString('base64')}]})}));
 try{await sessions.open(id,{auditPath:audit,artifactDir:join(root,'images')});await sessions.run(id,'secret input text');await sessions.close(id);const text=await readFile(audit,'utf8');assert(text.startsWith('{"previous":true}\n'));assert(!text.includes('secret input text'));const events=text.trim().split('\n').map(line=>JSON.parse(line));assert(events.some(value=>value.event==='run-complete'));const images=await readdir(join(root,'images'));assert.equal(images.length,1);assert.deepEqual(await readFile(join(root,'images',images[0])),bytes);const link=join(root,'link.jsonl');await symlink(audit,link);await assert.rejects(sessions.open(randomUUID(),{auditPath:link}));assert.equal(sessions.sessions.size,0)}finally{await sessions.dispose();await rm(root,{recursive:true,force:true})}
});
