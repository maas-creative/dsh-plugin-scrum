import {test} from 'node:test';import assert from 'node:assert/strict';
import {runDesktopCode} from './independent/desktop-code.mjs';
import {PeekabooDesktop} from './independent/desktop-peekaboo.mjs';
test('WASM window and element handles preserve chaining, capture images and guarded dispatch',async()=>{
 const calls=[],element={ref:'scrum-ax:fixture',role:'button'};
 const backend={window:async()=>({id:'42',bounds:{x:1,y:2,width:300,height:200}}),windowRead:async r=>{calls.push(r);if(r.method==='find')return [element];if(r.method==='ref')return element;if(r.method==='ax')return 'fixture tree';return {target:'42',width:10,height:10,mimeType:'image/png',data:Buffer.from('fixture').toString('base64')};},elementRead:async r=>{calls.push(r);if(r.method==='children')return [element];if(r.method==='parent')return null;if(r.method==='actions')return ['AXPress'];return 'fixture-value';},windowInput:async r=>{calls.push(r);return {applied:true}},elementInput:async r=>{calls.push(r);return {applied:true}}};
 const result=await runDesktopCode({backend,code:`const w=await desktop.window('42');const capture=await w.screenshot();const [e]=await w.find({role:'button'});const [child]=await e.children();return {value:await child.value(),actions:await e.actions(),parent:await e.parent(),tree:await w.ax(),width:capture.width,node:w.screenshot.constructor('return typeof process')()};`});
 assert.equal(result.displays.length,1);assert.deepEqual(result.returnValue,{value:'fixture-value',actions:['AXPress'],parent:null,tree:'fixture tree',width:10,node:'undefined'});
 const count=calls.length;await assert.rejects(runDesktopCode({backend,code:`const w=await desktop.window('42');return await w.send('raise')`}),/read-only/);await assert.rejects(runDesktopCode({backend,code:`const [e]=await (await desktop.window('42')).find({});return await e.setValue('changed')`}),/read-only/);assert.equal(calls.length,count+1);
 await runDesktopCode({backend,readOnly:false,code:`const w=await desktop.window('42');await w.method('raise')();const e=await w.ref('scrum-ax:fixture');return await e.perform('AXPress');`});assert(calls.some(r=>r.method==='raise'));assert(calls.some(r=>r.method==='perform'&&r.args[0]==='AXPress'));
 await assert.rejects(runDesktopCode({backend,readOnly:false,code:`return await (await desktop.window('42')).send('eval','process.exit()')`}),/Unsupported/);
});
test('readonly native AX request cannot be redirected into mutation by supplied fields',async()=>{
 const calls=[];const desktop=new PeekabooDesktop({executable:'/fixture/cli',observerExecutable:'/fixture/observe',runner:async(_,args)=>{calls.push(args);if(args[0]==='windows')return JSON.stringify([{id:'42',x:0,y:0,width:100,height:100}]);if(args[0]==='window-operation'){const r=JSON.parse(Buffer.from(args[1],'base64'));assert.equal(r.operation,'ax');assert.equal(r.id,'42');assert(!('ref' in r));return JSON.stringify('tree')}throw Error('unexpected')}});
 assert.equal(await desktop.windowRead({id:'42',method:'ax',args:[{operation:'raise',id:'different',ref:'foreign',limit:3}]},{}),'tree');
 await assert.rejects(desktop.windowRead({id:'42',method:'raise',args:[]},{}),/Invalid scoped/);
 await assert.rejects(desktop.elementRead({ref:'scrum-ax:fixture',method:'setValue',args:['x']},{}),/Invalid scoped/);
 await assert.rejects(desktop.elementInput({ref:'scrum-ax:fixture',method:'setValue',args:['x']},{}),/ownership/);
});

test('desktop input distinguishes proven nondispatch from uncertain results and never retries automatically',async()=>{
 let count=0;const error=Error('exit');Object.defineProperty(error,'desktopOutput',{value:JSON.stringify({success:false,error:{mutation_dispatched:false,retry_safe:true}})});
 const safe=new PeekabooDesktop({executable:'/fixture/cli',authorizeInput:()=>{},runner:async()=>{count++;throw error}});
 await assert.rejects(safe.click({x:1,y:2}),e=>e.notDispatched&&/not dispatched/.test(e.message));assert.equal(count,1);
 const uncertain=new PeekabooDesktop({executable:'/fixture/cli',authorizeInput:()=>{},runner:async()=>{count++;throw Error('connection lost')}});
 await assert.rejects(uncertain.click({x:1,y:2}),e=>!e.notDispatched&&/uncertain.*verify target/.test(e.message));assert.equal(count,2);
});

test('element click fallback stays inside its captured window rather than clicking an occluding foreground window',async()=>{
 let authorized=0,clicked;
 const desktop=new PeekabooDesktop({executable:'/fixture/cli',authorizeInput:()=>{authorized++}});
 desktop.elementRead=async request=>({actions:[],bounds:{x:130,y:240,width:20,height:10},window:'42'}[request.method]);
 desktop.window=async id=>{assert.equal(id,'42');return {bounds:{x:100,y:200,width:300,height:200}}};
 desktop.screenshot=async args=>{assert.equal(args.windowId,'42');return {width:600,height:400,frameId:'scoped-frame'}};
 desktop.click=async args=>{clicked=args;return {accepted:true}};
 await desktop.elementInput({ref:'scrum-ax:fixture',method:'click',args:[]},{});
 assert.equal(authorized,1);assert.deepEqual(clicked,{x:80,y:90,frameId:'scoped-frame'});
});
