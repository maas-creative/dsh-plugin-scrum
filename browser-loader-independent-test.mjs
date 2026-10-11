import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {loadOmowright,resolveOmowrightEntry} from './skills/browser/scripts/omowright.mjs';

test('independent loader honors a usable override and falls back without bypassing engine policy',async()=>{
  const directory=mkdtempSync(join(tmpdir(),'scrum-browser-loader-'));
  try {
    const bundled=resolveOmowrightEntry({});
    assert.equal(resolveOmowrightEntry({OMOWRIGHT_ROOT:directory}),bundled);
    writeFileSync(join(directory,'package.json'),' {"type":"module"}');
    writeFileSync(join(directory,'index.js'),'export const fixture=true;export async function connect(){return {}}');
    const loaded=await loadOmowright({OMOWRIGHT_ROOT:directory,OMO_BROWSER_ENGINE:'connected'});
    assert.equal(loaded.entry,join(directory,'index.js'));
    assert.equal(loaded.omowright.fixture,true);
    await assert.rejects(loaded.omowright.connect(),/own browser|owned browser/);
    const normal=await loadOmowright({OMO_BROWSER_ENGINE:'connected'});
    assert.equal(normal.entry,bundled);
    assert.equal(typeof normal.omowright.BskIpcClient,'function');
  } finally {rmSync(directory,{recursive:true,force:true});}
});

test('independent loader preserves explicit host and kernel namespace bridge state callbacks',async()=>{
  const messages=[];
  const client={call:async method=>method==='system.status'?{browsers:[{}]}:method==='session.start'?{session_id:'fixture'}:{}};
  const explicit={listTools:()=>[],callTool:async(name,args)=>{messages.push({name,args});return {}}};
  const loaded=await loadOmowright({OMO_BROWSER_ENGINE:'connected'},explicit);
  const session=await loaded.omowright.connectBrowserSkill({client});
  await session.stop();
  assert.ok(messages.some(x=>x.args.data?.status==='started'));
  assert.ok(messages.some(x=>x.args.data?.status==='stopped'));
  const priorTool=globalThis.tool,priorSchema=globalThis.tool_schema;
  try {
    messages.length=0;
    globalThis.tool={omo_browser_bridge:async args=>{messages.push({args});return {}}};
    globalThis.tool_schema=()=>[{name:'omo_browser_bridge'}];
    const kernel=await loadOmowright({OMO_BROWSER_ENGINE:'connected'});
    const connected=await kernel.omowright.connectBrowserSkill({client});
    await connected.stop();
    assert.ok(messages.some(x=>x.args.data?.status==='stopped'));
  } finally {globalThis.tool=priorTool;globalThis.tool_schema=priorSchema;}
});
