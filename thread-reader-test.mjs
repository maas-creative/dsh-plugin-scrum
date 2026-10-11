import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {readTranscript} from './independent/thread-reader.mjs';

test('file transcript preserves valid records and reports broken lines without inventing messages',()=>{
 const directory=mkdtempSync(join(tmpdir(),'scrum-thread-reader-'));try{
  const path=join(directory,'session.jsonl');writeFileSync(path,'{"type":"session","id":"s"}\ninvalid\n{"role":"user","content":"日本語"}\n');
  const source={kind:'file',path},result=readTranscript(source);
  assert.equal(result.total_items,2);assert.equal(result.skipped_lines,1);assert.equal(result.source_incomplete,true);
  assert.equal(result.items[1].content,'日本語');
  const status=readTranscript(source,{mode:'status'});assert.equal(status.total_items,2);assert.deepEqual(status.items,[]);assert.equal(status.encoded_bytes,0);
  assert.equal(readTranscript({kind:'file',path:join(directory,'missing')}).error.code,'not_found');
 }finally{rmSync(directory,{recursive:true,force:true})}
});
test('single oversized item is never returned over budget or silently skipped',()=>{
 const source={kind:'live',id:'one',entries:()=>[{content:'日本語'.repeat(20)},{content:'next'}]};
 const small=readTranscript(source,{max_bytes:10});assert.equal(small.error.code,'message_too_large');
 assert.match(small.error.next_action,/Increase max_bytes/);
 const large=readTranscript(source,{max_bytes:1000});assert.equal(large.items.length,2);assert(large.encoded_bytes<=1000);
});
test('identical messages in different sessions cannot reuse each others paging cursor',()=>{
 const messages=[{content:'one'},{content:'two'}],a={kind:'live',id:'a',entries:()=>messages},b={kind:'live',id:'b',entries:()=>messages};
 const first=readTranscript(a,{max_bytes:18});assert(first.next_cursor);
 assert.equal(readTranscript(b,{mode:'page',cursor:first.next_cursor}).error.code,'cursor_stale');
 assert.equal(readTranscript(a,{cursor:Buffer.from(JSON.stringify({version:1,index:-1,revision:'x'})).toString('base64url')}).error.code,'cursor_invalid');
});
