import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtempSync,rmSync,readFileSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {ProcessRegistry,processIdentity} from './process-registry.mjs';
const gone=pid=>{try{process.kill(pid,0);return false}catch(error){return error.code==='ESRCH'}};
test('crashed owner recovery terminates only marker-confirmed monitor process groups',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'monitor-crash-')),module=new URL('./process-monitor.mjs',import.meta.url).href;
 const host=spawn(process.execPath,['--input-type=module','-e',`import {ProcessMonitor} from ${JSON.stringify(module)};const monitor=new ProcessMonitor({stateDirectory:${JSON.stringify(dir)}});const job=monitor.start({command:process.execPath,args:['-e','setInterval(()=>{},1000)'],ownerSession:'owned'});console.log(JSON.stringify(job));setInterval(()=>{},1000);`],{stdio:['ignore','pipe','pipe']});let owned,foreign;
 try{
  owned=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('host start timeout')),5000);host.stdout.on('data',chunk=>{buffer+=chunk;const end=buffer.indexOf('\n');if(end>=0){clearTimeout(timer);resolve(JSON.parse(buffer.slice(0,end)))}});host.once('error',reject)});
  assert.equal(processIdentity(owned.pid,owned.id),true);
  foreign=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{detached:true,stdio:'ignore'});const exited=new Promise(resolve=>host.once('exit',resolve));host.kill('SIGKILL');await exited;
  const registry=new ProcessRegistry(dir);registry.save({id:'foreign',pid:foreign.pid,hostPid:host.pid,token:'forged',ownerSession:'peer'});
  const result=registry.recover();assert.equal(result.find(r=>r.id===owned.id).status,'recovered-stopped');assert.equal(result.find(r=>r.id==='foreign').status,'identity-unconfirmed');assert.equal(gone(foreign.pid),false);
  for(let i=0;i<100&&!gone(owned.pid);i++)await new Promise(resolve=>setTimeout(resolve,20));assert.equal(gone(owned.pid),true);
 }finally{if(host.exitCode===null)host.kill('SIGKILL');if(owned&&!gone(owned.pid))try{process.kill(-owned.pid,'SIGKILL')}catch{}if(foreign&&!gone(foreign.pid))try{process.kill(-foreign.pid,'SIGKILL')}catch{}rmSync(dir,{recursive:true,force:true})}
});

test('crash cleanup confirms inherited markers when the original group leader has exited',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'monitor-orphan-')),module=new URL('./process-monitor.mjs',import.meta.url).href,pidFile=join(dir,'descendant');
 const command="const {spawn}=require('node:child_process');const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});require('node:fs').writeFileSync("+JSON.stringify(pidFile)+",String(child.pid));setInterval(()=>{},1000)";
 const host=spawn(process.execPath,['--input-type=module','-e',`import {ProcessMonitor} from ${JSON.stringify(module)};const monitor=new ProcessMonitor({stateDirectory:${JSON.stringify(dir)}});console.log(JSON.stringify(monitor.start({command:process.execPath,args:['-e',${JSON.stringify(command)}]})));setInterval(()=>{},1000);`],{stdio:['ignore','pipe','pipe']});let owned,descendant;
 try{
  owned=await new Promise((resolve,reject)=>{let buffer='';const timer=setTimeout(()=>reject(Error('host timeout')),5000);host.stdout.on('data',chunk=>{buffer+=chunk;if(buffer.includes('\n')){clearTimeout(timer);resolve(JSON.parse(buffer.split('\n')[0]))}})});
  for(let i=0;i<100&&!descendant;i++){try{descendant=Number(readFileSync(pidFile,'utf8'))}catch{}if(!descendant)await new Promise(resolve=>setTimeout(resolve,20))}assert(descendant>0);
  const exited=new Promise(resolve=>host.once('exit',resolve));host.kill('SIGKILL');await exited;process.kill(owned.pid,'SIGKILL');
  for(let i=0;i<100&&!gone(owned.pid);i++)await new Promise(resolve=>setTimeout(resolve,20));assert(gone(owned.pid));assert(processIdentity(descendant,owned.id,owned.pid));
  assert.equal(new ProcessRegistry(dir).recover().find(r=>r.id===owned.id).status,'recovered-stopped');for(let i=0;i<100&&!gone(descendant);i++)await new Promise(resolve=>setTimeout(resolve,20));assert(gone(descendant));
 }finally{if(host.exitCode===null)host.kill('SIGKILL');if(owned)try{process.kill(-owned.pid,'SIGKILL')}catch{}rmSync(dir,{recursive:true,force:true})}
});
