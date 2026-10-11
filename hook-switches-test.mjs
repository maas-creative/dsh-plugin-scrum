import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import {join} from 'node:path';import {tmpdir} from 'node:os';
import {Context} from '@deepseek-ai/cordis';import {registerHooks} from './hooks.mjs';
test('completed empty Task carries pinned completed-not-waiting warning, without changing native errors or retrying',async()=>{
 const ctx=new Context();registerHooks(ctx);let calls=0;
 for(const name of ['task','Task']){
  const result={isError:false,content:[{type:'text',text:'  '}]};
  const decision=await ctx.waterfall('tools/post-execute',{name,callId:'empty'},result,async()=>{calls++;return {kind:'accept'}});
  assert.match(decision.content.at(-1).text,/call has already completed/);assert.match(decision.content.at(-1).text,/NOT waiting/);assert.equal(result.content[0].text,'  ');
 }
 assert.equal(calls,2);
 assert.deepEqual(await ctx.waterfall('tools/post-execute',{name:'task'},{content:[{type:'text',text:'Completed report'}]},async()=>({kind:'accept'})),{kind:'accept'});
 const denied={kind:'reject',reason:'Native policy'};assert.equal(await ctx.waterfall('tools/post-execute',{name:'task'},{content:[]},async()=>denied),denied);
});
test('named hook switches apply and reload without removing native permission decisions',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'scrum-hook-switch-')),ctx=new Context(),agent={session:{id:'owner',header:{cwd}}};
 try{
  await mkdir(join(cwd,'.omo'));const path=join(cwd,'.omo/omo.json');
  const write=names=>writeFile(path,JSON.stringify({disabled_hooks:names,hashline_edit:true}));
  const names=['notepad-write-guard','empty-task-response-detector','json-error-recovery','edit-error-recovery','hashline-read-enhancer','bash-file-read-guard','comment-checker','non-interactive-env','read-image-resizer','plan-format-validator'];
  await write(names);registerHooks(ctx,{formatter:{mode:'off'}});
  const pre=prior=>ctx.waterfall('tools/pre-execute',{name:'write',arguments:{file_path:'.omo/notepads/a.md'},agent},async()=>prior);
  const post=(name,text)=>ctx.waterfall('tools/post-execute',{name,arguments:{},agent},{isError:name==='edit'||name==='mcp_custom',content:[{type:'text',text}]},async()=>({kind:'accept'}));
  assert.equal((await pre({kind:'allow'})).kind,'allow');
  const native={kind:'deny',reason:'Immutable host denial'};assert.equal(await pre(native),native);
  assert.deepEqual(await post('task',''),{kind:'accept'});
  assert.deepEqual(await post('mcp_custom','JSON parse error'),{kind:'accept'});
  assert.deepEqual(await post('edit','old_string was not found'),{kind:'accept'});
  await write([]);
  assert.equal((await pre({kind:'allow'})).kind,'deny');
  assert.match((await post('task','')).content.at(-1).text,/Task Empty Response Warning/);
  assert.match((await post('mcp_custom','JSON parse error')).content.at(-1).text,/JSON PARSE ERROR/);
  assert.match((await post('edit','old_string was not found')).content.at(-1).text,/READ the file immediately/);
  assert.equal(await pre(native),native);
 }finally{await rm(cwd,{recursive:true,force:true});}
});
