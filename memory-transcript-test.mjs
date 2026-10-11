import test from 'node:test';import assert from 'node:assert/strict';import {hydrateMemoryTranscript} from './memory-transcript.mjs';
const human=(seq,id,text,kind='user')=>({seq,type:'user/message',data:{id,source:{kind},text}}),flatten=data=>data.text;
test('cold debounce restores unqueued accepted history without duplicating the triggering event',async()=>{
 const events=[human(1,'one','First durable fact'),human(2,'relay','Ignore','agent'),{seq:3,type:'assistant/message',data:{message:{id:'a',text:'Acknowledged'}}},human(5,'two','Second fact')];
 let closed=false;const ctx={sessionPersistence:{open:async()=>({read:async()=>({events:events.slice(0,3)}),close:async()=>{closed=true}})}};
 const entries=await hydrateMemoryTranscript({ctx,session:{id:'s',snapshotEvents:()=>events},event:events.at(-1),queue:{transcript:()=>[]},flatten});assert.deepEqual(entries,[{id:'one',role:'user',text:'First durable fact'},{id:'a',role:'assistant',text:'Acknowledged'}]);assert.equal(closed,true);
 const queue={transcript:()=>entries.slice(0,1)};assert.deepEqual(await hydrateMemoryTranscript({ctx,session:{id:'s',snapshotEvents:()=>events},event:events.at(-1),queue,flatten}),entries);
 await assert.rejects(hydrateMemoryTranscript({ctx,session:{id:'s',snapshotEvents:()=>events},event:events.at(-1),queue:{transcript:()=>[{...entries[0],text:'Changed canonical fact'}]},flatten}),/canonical memory checkpoint/);
});
