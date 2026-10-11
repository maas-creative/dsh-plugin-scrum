import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PeekabooDesktop} from './independent/desktop-peekaboo.mjs';
import {runDesktopCode} from './independent/desktop-code.mjs';
import {getQuickJS} from 'quickjs-emscripten';
const rows=[{id:'1',app:'Editor',title:'One',pid:10,x:1,y:2,width:300,height:200,focused:true,elevated:null},{id:'2',app:'Editor',title:'Two',pid:10,x:4,y:5,width:400,height:300,focused:false,elevated:null}];
const observer=()=>new PeekabooDesktop({executable:'/fixture/peekaboo',observerExecutable:'/fixture/observe',runner:async(exe,args)=>{assert.equal(exe,'/fixture/observe');switch(args[0]){case 'permissions':return JSON.stringify({capture:true,input:true,ax:true});case 'displays':return JSON.stringify([{id:'display-1'}]);case 'windows':return JSON.stringify(rows);case 'focused-window':return JSON.stringify({id:'1',focused:true});default:throw Error('unexpected')}}});
test('native observation adapter preserves window IDs, null elevation and unambiguous selectors',async()=>{
 const backend=observer();assert.deepEqual(await backend.windows(),rows);assert.equal((await backend.capabilities()).backgroundWindowInput,true);assert.deepEqual((await backend.capabilities()).deliveryModes,['foreground','background-window']);assert.equal((await backend.capabilities()).displayCount,1);assert.equal((await backend.window('1')).title,'One');assert.equal((await backend.window({title:'Two'})).id,'2');await assert.rejects(backend.window('Editor'),/Ambiguous/);await assert.rejects(backend.window({unknown:true}),/not found/);assert.equal((await backend.focusedWindow()).id,'1');
});
test('WASM desktop observation accepts string selectors in read-only runs',async()=>{
 const result=await runDesktopCode({QuickJS:await getQuickJS(),backend:observer(),code:'const selected=await desktop.window("2");return {id:selected.id,count:(await desktop.windows()).length,focused:(await desktop.focusedWindow()).id};'});assert.deepEqual(result.returnValue,{id:'2',count:2,focused:'1'});
 const absent=new PeekabooDesktop({executable:'/fixture/peekaboo'});await assert.rejects(absent.windows(),/observer unavailable/);
});

test('AX positional arguments and clipboard boundaries pass through the isolated guest',async()=>{
 let written;const backend={focusedElement:async()=>({ref:'scrum-ax:fixture'}),elementAt:async(x,y)=>({ref:`${x}:${y}`}),ref:async value=>({ref:value}),clipboardRead:async()=> 'clipboard text',clipboardWrite:async text=>{written=text;return {written:true}}};
 const result=await runDesktopCode({backend,code:'const e=await desktop.focusedElement();return {resolved:(await desktop.ref(e.ref)).ref,point:(await desktop.elementAt(1,2)).ref,text:await desktop.clipboard.read()};'});assert.deepEqual(result.returnValue,{resolved:'scrum-ax:fixture',point:'1:2',text:'clipboard text'});
 await assert.rejects(runDesktopCode({backend,code:'return await desktop.clipboard.write("new")'}),/read-only/);assert.equal(written,undefined);
 await runDesktopCode({backend,readOnly:false,code:'return await desktop.clipboard.write("new")'});assert.equal(written,'new');
});
