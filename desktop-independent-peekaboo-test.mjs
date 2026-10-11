import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PeekabooDesktop,runDesktopCommand} from './independent/desktop-peekaboo.mjs';

test('independent desktop adapter authorizes every input and preserves argv boundaries',async()=>{
 const calls=[];let authorized=0;
 const desktop=new PeekabooDesktop({executable:'/fixture/peekaboo',authorizeInput:()=>{authorized++},runner:async(exe,args)=>{calls.push({exe,args});return JSON.stringify({success:true,data:{accepted:true}})}});
 await desktop.click({x:12,y:34,count:2});await desktop.press({keys:'cmd+shift+t'});await desktop.scroll({direction:'down',amount:3});await desktop.drag({from:{x:1,y:2},to:{x:3,y:4}});
 await desktop.type({text:'--clear\\n $literal'});await desktop.move({x:8,y:9});assert.equal(authorized,6);assert(calls[4].args[1].startsWith('--text=--clear'));assert.equal(calls[4].args.length,5);assert.deepEqual(calls[0].args,['click','--at','12,34','--global','--double','--foreground','--no-remote','--json']);
 await assert.rejects(desktop.press({keys:'--app'}),/Invalid/);await assert.rejects(desktop.scroll({direction:'down',amount:Infinity}),/Invalid/);
 const readonly=new PeekabooDesktop({executable:'/fixture/peekaboo',runner:async()=>{throw Error('must not execute')}});
 await assert.rejects(readonly.click({x:1,y:2}),/ownership and live emergency stop/);
 const suspended=new PeekabooDesktop({executable:'/fixture/peekaboo',authorizeInput:()=>{throw Error('suspended')},runner:async()=>{throw Error('must not execute')}});
 await assert.rejects(suspended.click({x:1,y:2}),/suspended/);
});
test('desktop command bounds output, cancellation and failure without leaking stderr',async()=>{
 assert.equal(await runDesktopCommand(process.execPath,['-e','process.stdout.write("ok")']),'ok');
 await assert.rejects(runDesktopCommand(process.execPath,['-e','process.stderr.write("secret-value");process.exit(1)']),error=>!error.message.includes('secret-value')&&/status 1/.test(error.message));
 await assert.rejects(runDesktopCommand(process.execPath,['-e','process.stdout.write("x".repeat(10000));setInterval(()=>{},1000)'],{maxBytes:100}),/exceeds limit/);
 await assert.rejects(runDesktopCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{timeoutMs:50}),/timed out/);
 const controller=new AbortController();const pending=runDesktopCommand(process.execPath,['-e','setInterval(()=>{},1000)'],{signal:controller.signal});controller.abort(Error('human stop'));await assert.rejects(pending,/human stop/);
});
test('desktop adapter refuses malformed or unsuccessful CLI receipts',async()=>{
 const invalid=new PeekabooDesktop({executable:'/fixture/peekaboo',runner:async()=>'{'});await assert.rejects(invalid.permissions(),/Invalid Peekaboo JSON/);
 const failure=new PeekabooDesktop({executable:'/fixture/peekaboo',runner:async()=>JSON.stringify({success:false,error:'private text'})});await assert.rejects(failure.permissions(),error=>error.message==='Peekaboo rejected desktop operation');
});

test('desktop frame coordinates honor display origins and reject stale or changed geometry',async()=>{
 let changed=false,authorized=0;const calls=[];
 const desktop=new PeekabooDesktop({executable:'/fixture/peekaboo',authorizeInput:()=>authorized++,runner:async(_,args)=>{calls.push(args);if(args[0]==='screen')return JSON.stringify({success:true,data:{screens:[{displayID:7,bounds:{x:changed?0:-200,y:40,width:1000,height:800}}]}});return JSON.stringify({success:true,data:{accepted:true}})}});
 desktop.frames.set('frame',{width:500,height:400,createdAt:Date.now(),displayID:7,bounds:{x:-200,y:40,width:1000,height:800}});
 await desktop.click({x:50,y:50,frameId:'frame'});assert.equal(calls[1][2],'-100,140');assert.equal(authorized,1);
 await assert.rejects(desktop.click({x:500,y:1,frameId:'frame'}),/outside/);
 await assert.rejects(desktop.click({x:1,y:1,frameId:'other'}),/Stale/);
 changed=true;await assert.rejects(desktop.move({x:1,y:1,frameId:'frame'}),/display changed/);assert.equal(authorized,1);
 desktop.frames.get('frame').createdAt=Date.now()-60001;await assert.rejects(desktop.click({x:1,y:1,frameId:'frame'}),/Stale/);
});

test('background window actions use snapshot targeting and never request foreground activation',async()=>{
 const calls=[];let changed=false;
 const desktop=new PeekabooDesktop({executable:'/fixture/peekaboo',observerExecutable:'/fixture/observer',authorizeInput:()=>{},runner:async(exe,args)=>{
  if(exe==='/fixture/observer')return JSON.stringify([{id:'42',app:'Fixture',title:'Owned',pid:1,x:changed?110:100,y:200,width:500,height:300}]);
  calls.push(args);return JSON.stringify({success:true,data:{accepted:true}});
 }});
 desktop.frames.set('window',{windowId:'42',snapshotId:'receipt',width:250,height:150,createdAt:Date.now(),bounds:{x:100,y:200,width:500,height:300}});
 await desktop.click({x:10,y:20,frameId:'window'});
 await desktop.type({text:'hello',frameId:'window'});
 await desktop.press({keys:'cmd+a',frameId:'window'});
 await desktop.scroll({direction:'down',frameId:'window'});
 await desktop.drag({from:{x:10,y:20},to:{x:20,y:30},frameId:'window'});
 assert(calls.every(args=>!args.includes('--foreground')&&args.includes('--snapshot')));
 assert.equal(calls[0][2],'20,40');
 const drag=calls[4];assert(!drag.includes('--window-id'));assert.equal(drag[2],'120,240');assert.equal(drag[4],'140,260');
 changed=true;await assert.rejects(desktop.drag({from:{x:1,y:1},to:{x:2,y:2},frameId:'window'}),/window changed/);assert.equal(calls.length,5);
});
