import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {guardOmowright,textareaNewlineExpression} from './independent/browser-guard.mjs';
import * as runtime from './skills/browser/runtime/omowright/index.js';

async function fixture(answer='Allow',label='Send',hostCallback,evaluateResult) {
  const calls=[],notices=[];
  const client={callWithHandle(){throw new Error('unguarded transport reached')},resolveSocket(){throw new Error('unguarded socket reached')},call:async(method,params)=>{
    calls.push({method,params});
    if(method==='system.status')return {browsers:[{}]};
    if(method==='session.start')return {session_id:'fixture'};
    if(method==='tool.evaluate'&&evaluateResult)return {value:evaluateResult};
    if(method==='tool.get_html')return {html:'<button>'+label+'</button>'};
    return {};
  }};
  const host={callTool:async(name,args)=>{
    notices.push({name,args});
    if(hostCallback)return hostCallback(name,args);
    return name==='ask_user_question'?{details:answer?{status:'answered',answers:{q:answer}}:{status:'pending',answers:{}}}:{};
  }};
  const session=await guardOmowright(runtime,{env:{OMO_BROWSER_ENGINE:'connected'},host}).connectBrowserSkill({client});
  return {session,calls,notices};
}

test('independent browser guard only dispatches a risky click after one explicit answered approval',async()=>{
  for(const answer of ['Allow',"Don't allow",null]) {
    const f=await fixture(answer);
    if(answer==='Allow')await f.session.click({ref:'e1'});
    else await assert.rejects(f.session.click({ref:'e1'}),error=>error.code==='user_declined');
    assert.equal(f.calls.some(x=>x.method==='tool.click'),answer==='Allow');
  }
  const harmless=await fixture(null,'Open');
  await harmless.session.click({ref:'e1'});
  assert.equal(harmless.notices.some(x=>x.name==='ask_user_question'),false);
});

test('stop during pending confirmation prevents late approval from dispatching and rejects queued work',async()=>{
  let answer,question;
  const appeared=new Promise(resolve=>question=resolve);
  const f=await fixture(null,'Send',async name=>{
    if(name!=='ask_user_question')return {};
    question();return new Promise(resolve=>answer=resolve);
  });
  const click=f.session.click({ref:'e1'});
  await appeared;
  await f.session.stop();
  answer({details:{status:'answered',answers:{q:'Allow'}}});
  await assert.rejects(click,error=>error.code==='user_stopped');
  await assert.rejects(f.session.snapshot(),error=>error.code==='user_stopped');
  assert.equal(f.calls.some(x=>x.method==='tool.click'),false);
});

test('raw client and tool access retain owning-session checks and confirmation',async()=>{
  const f=await fixture(null);
  await assert.rejects(f.session.client.call('tool.click',{ref:'e1',session_id:'fixture'}),error=>error.code==='user_declined');
  await assert.rejects(f.session.tool('snapshot',{session_id:'other'}),error=>error.code==='browser_session_scope');
  assert.throws(()=>f.session.client.call('session.start',{}),error=>error.code==='browser_rpc_scope');
  assert.throws(()=>f.session.client.callWithHandle('tool.click',{ref:'e1'}),error=>error.code==='browser_rpc_scope');
  assert.throws(()=>f.session.client.resolveSocket(),error=>error.code==='browser_rpc_scope');
  assert.equal(f.calls.some(x=>x.method==='tool.click'),false);
  assert.equal(f.calls.some(x=>x.params?.session_id==='other'),false);
});

test('configured modes block alternate constructors and unset mode retains the original namespace',async()=>{
  assert.equal(guardOmowright(runtime,{env:{}}),runtime);
  for(const engine of ['builtin','none','owned']) {
    const guarded=guardOmowright(runtime,{env:{OMO_BROWSER_ENGINE:engine}});
    await assert.rejects(guarded.connectBrowserSkill(),error=>error.name==='BrowserEngineRefusal');
    assert.throws(()=>new guarded.BskIpcClient(),error=>error.code==='browser_engine_export_blocked');
  }
});

test('persisted host stop refuses creation and stop during an awaited state callback refuses dispatch',async()=>{
  let created=false;
  const namespace={connectBrowserSkill:async()=>{created=true;return {}}};
  const stopped=guardOmowright(namespace,{env:{OMO_BROWSER_ENGINE:'connected'},host:{callTool:async()=>({details:{stopped:true}})}});
  await assert.rejects(stopped.connectBrowserSkill(),error=>error.code==='user_stopped');
  assert.equal(created,false);
  let session;
  const f=await fixture('Allow','Open',async(name,args)=>{
    if(name==='omo_browser_bridge'&&args.data?.status==='acting')await session.stop();
    return {};
  });
  session=f.session;
  await assert.rejects(session.click({ref:'e1'}),error=>error.code==='user_stopped');
  assert.equal(f.calls.some(x=>x.method==='tool.click'),false);
});

 test('navigation keys and space do not trigger a submission confirmation, Enter requires approval',async()=>{
  const f=await fixture(null);
  for(const key of ['Tab','Escape','Space',' '])await f.session.press(key);
  assert.equal(f.notices.some(x=>x.name==='ask_user_question'),false);
  await assert.rejects(f.session.press('Enter'),error=>error.code==='user_declined');
  assert.equal(f.calls.filter(x=>x.method==='tool.press').length,4);
 });

 test('textarea Enter inserts a newline without submitting and refuses read-only or single-line fields',()=>{
  for(const editable of [true,false]) {
    let value='ab',inputs=0;
    const node={tagName:'TEXTAREA',readOnly:!editable,selectionStart:1,selectionEnd:1,setRangeText(text){value=value.slice(0,1)+text+value.slice(1)},dispatchEvent(){inputs++}};
    const context={document:{activeElement:node},Event:class{}};
    const result=vm.runInNewContext(textareaNewlineExpression(),context);
    assert.equal(result.scrumNewline,editable);
    assert.equal(value,editable?'a\nb':'ab');
    assert.equal(inputs,editable?1:0);
  }
  assert.equal(vm.runInNewContext(textareaNewlineExpression(),{document:{activeElement:{tagName:'INPUT'}}}).scrumNewline,false);
 });

 test('real session Enter routes a successful textarea edit without native key submission',async()=>{
  const f=await fixture(null,'Send',undefined,{scrumNewline:true});
  await f.session.press('Enter');
  assert.equal(f.calls.filter(x=>x.method==='tool.evaluate').length,1);
  assert.equal(f.calls.some(x=>x.method==='tool.press'),false);
  assert.equal(f.notices.some(x=>x.name==='ask_user_question'),false);
 });

 test('independent export policy matches the observed public function classification',async()=>{
  const contract=JSON.parse(readFileSync(new URL('./test-fixtures/browser-public-export-contract.json',import.meta.url),'utf8'));
  for(const row of contract.result) {
    if(row.name==='connectBrowserSkill')continue;
    let called=false;
    const namespace={[row.name]:function(){called=true;return {}}};
    const guarded=guardOmowright(namespace,{env:{OMO_BROWSER_ENGINE:'connected'}});
    if(row.called)await guarded[row.name]();
    else if(['connect','connectPipe','connectCloakProfile'].includes(row.name))await assert.rejects(guarded[row.name](),error=>error.code===row.error);
    else assert.throws(()=>guarded[row.name](),error=>error.code===row.error);
    assert.equal(called,row.called,row.name);
  }
 });
