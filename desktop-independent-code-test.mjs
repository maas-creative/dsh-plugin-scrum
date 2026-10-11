import {test} from 'node:test';
import assert from 'node:assert/strict';
import {getQuickJS} from 'quickjs-emscripten';
import {runDesktopCode} from './independent/desktop-code.mjs';
const QuickJS=await getQuickJS();
test('desktop WASM sandbox resolves async host calls without exposing Node or host constructors',async()=>{
 const calls=[];const backend={screenshot:async args=>{calls.push(args);return {width:100,height:50,mimeType:'image/png',data:'aW1hZ2U='}}};
 const result=await runDesktopCode({QuickJS,backend,code:'const capture=await desktop.screenshot({screenIndex:0});return {width:capture.width,node:typeof process,require:typeof require,escape:desktop.screenshot.constructor("return typeof process")()};'});
 assert.deepEqual(result.returnValue,{width:100,node:'undefined',require:'undefined',escape:'undefined'});assert.equal(result.displays.length,1);assert.deepEqual(calls,[{screenIndex:0}]);
});
test('desktop WASM sandbox rejects readonly input, invalid host arguments and backend errors',async()=>{
 let input=0;const backend={click:async()=>{input++},screenshot:async()=>{throw Error('capture denied')}};
 await assert.rejects(runDesktopCode({QuickJS,backend,code:'return await desktop.click({x:1,y:2})'}),/read-only/);assert.equal(input,0);
 await assert.rejects(runDesktopCode({QuickJS,backend,code:'return await desktop.screenshot("wrong")'}),/Invalid desktop argument/);
 await assert.rejects(runDesktopCode({QuickJS,backend,code:'return await desktop.screenshot()'}),/capture denied/);
});
test('desktop WASM sandbox bounds CPU and memory and aborts outstanding native work',async()=>{
 await assert.rejects(runDesktopCode({QuickJS,backend:{},code:'while(true){}',timeoutMs:30}),/interrupted|timed out/);
 await assert.rejects(runDesktopCode({QuickJS,backend:{},code:'const buffers=[];while(true){buffers.push(new ArrayBuffer(65536))}',memoryBytes:1024*1024,timeoutMs:1000}),/out of memory/);
 const controller=new AbortController();let stopped=false;
 const backend={screenshot:async(_,options)=>new Promise((_,reject)=>{options.signal.addEventListener('abort',()=>{stopped=true;reject(options.signal.reason)},{once:true});setTimeout(()=>controller.abort(Error('human stop')),30)})};
 const pending=runDesktopCode({QuickJS,backend,code:'return await desktop.screenshot()',signal:controller.signal});await assert.rejects(pending,/human stop/);assert.equal(stopped,true);
});
test('desktop WASM sandbox serializes host operations and settles unawaited work before returning',async()=>{
 let active=0,max=0,finished=0;const backend={screenshot:async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,5));active--;finished++;return {width:1}}};
 const result=await runDesktopCode({QuickJS,backend,code:'desktop.screenshot();desktop.screenshot();return 7;'});assert.equal(result.returnValue,7);assert.equal(max,1);assert.equal(finished,2);
});

test('desktop guest infinite loop leaves host timers responsive and stops on host abort',async()=>{
 const controller=new AbortController();let started=false,ticks=0;const heartbeat=setInterval(()=>ticks++,10);
 try{
  const backend={capabilities:async()=>{started=true;setTimeout(()=>controller.abort(Error('native emergency stop')),40);return {}}};
  await assert.rejects(runDesktopCode({backend,code:'await desktop.capabilities();while(true){}',signal:controller.signal,timeoutMs:5000}),/native emergency stop/);
  assert.equal(started,true);assert(ticks>=2);
 }finally{clearInterval(heartbeat)}
});

test('guest cannot replace trusted cancellation options with extra positional arguments',async()=>{
 let invoked=false;const backend={screenshot:async()=>{invoked=true;return {width:1}}};
 await assert.rejects(runDesktopCode({backend,code:'return await desktop.screenshot({}, {signal:null})'}),/Invalid desktop argument/);assert.equal(invoked,false);
});

test('desktop cancellation before worker dispatch never begins native work',async()=>{
 const controller=new AbortController();let calls=0;
 const pending=runDesktopCode({backend:{screenshot:async()=>{calls++;return {}}},code:'return await desktop.screenshot()',signal:controller.signal});
 controller.abort(Error('stop before dispatch'));
 await assert.rejects(pending,/stop before dispatch/);assert.equal(calls,0);
});
