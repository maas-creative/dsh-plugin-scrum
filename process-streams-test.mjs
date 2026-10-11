import test from 'node:test';
import assert from 'node:assert/strict';
import {LineStream,MonitorBatcher,createMonitorFilter} from './independent/process-streams.mjs';

test('process lines preserve split UTF8 and bound a newline-free stream',()=>{
 const stream=new LineStream({lineMaxBytes:6}),bytes=Buffer.from('日本語\nnext\n');
 let lines=[];for(const byte of bytes)lines.push(...stream.feed(Buffer.from([byte])).lines);
 lines.push(...stream.flush().lines);
 assert.deepEqual(lines.map(x=>x.text),['日本','next']);assert.equal(lines[0].truncated,true);
 assert(lines.every(x=>Buffer.byteLength(x.text)<=6));
 const binary=new LineStream();const result=binary.feed(Buffer.from('a\0b\n'));
 assert.equal(result.lines[0].binary,true);assert.equal(result.lines[0].text,'');assert.equal(result.binarySuppressedBytes,4);
});
test('batch sequence is monotonic and disposal prevents late timer deliveries',async()=>{
 const batches=[],batcher=new MonitorBatcher({batchMaxLines:2,batchMaxBytes:100,flushIntervalMs:10});batcher.onBatch(x=>batches.push(x));
 batcher.push({text:'a'});batcher.push({text:'b'});assert.equal(batches[0].lines.length,2);
 batcher.push({text:'c'});batcher.flushNow();assert.equal(batches[1].batchSeq,2);
 batcher.push({text:'d'});batcher.destroy();await new Promise(resolve=>setTimeout(resolve,25));
 assert.equal(batches.length,2);assert.equal(batcher.pendingCount(),0);
});
test('pattern filter keeps normal regex features and rejects nested repetition',()=>{
 assert.equal(createMonitorFilter('(a+)+$').filter,undefined);
 assert(createMonitorFilter('(a|b)+').filter.matches('ab'));
 assert(createMonitorFilter('(?<=abc)d').filter.matches('abcd'));
 assert.equal(createMonitorFilter('[').filter,undefined);
});
