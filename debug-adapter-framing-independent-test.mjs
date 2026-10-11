import test from 'node:test';import assert from 'node:assert/strict';
import {DapFrameParser,isTcpAdapterSpec,MAX_OUTPUT_BYTES,MAX_ROWS} from './skills/debugging/references/scripts/dap.mjs';
const frame=value=>{const body=JSON.stringify(value);return Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);};
test('DAP byte fragments retain UTF-8 messages and multiple frame boundaries',()=>{
 const message={seq:1,type:'event',event:'output',body:{output:'日本語'}},parser=new DapFrameParser(),bytes=Buffer.concat([frame(message),frame({seq:2,type:'event',event:'stopped'})]),messages=[];
 for(const byte of bytes)messages.push(...parser.push(Buffer.from([byte])));
 assert.deepEqual(messages,[message,{seq:2,type:'event',event:'stopped'}]);assert.equal(MAX_OUTPUT_BYTES,32768);assert.equal(MAX_ROWS,100);
});
test('malformed JSON does not discard the following complete DAP frame',()=>{
 assert.deepEqual(new DapFrameParser().push(Buffer.concat([Buffer.from('Content-Length: 1\r\n\r\nx'),frame({ok:true})])),[{ok:true}]);
 assert.deepEqual(new DapFrameParser().push(Buffer.from('Extra: ok\r\ncontent-length: 2\r\n\r\n{}')),[{}]);
});
test('oversized headers and frames fail boundedly and allow a fresh parser stream',()=>{
 const parser=new DapFrameParser();assert.throws(()=>parser.push(Buffer.from('x'.repeat(8193))),/header exceeds/);assert.deepEqual(parser.push(frame({ok:true})),[{ok:true}]);
 assert.throws(()=>parser.push(Buffer.from('Content-Length: 9999999999999\r\n\r\n')),/frame exceeds/);
});
test('adapter endpoint classification retains the observable host-port contract',()=>{
 for(const spec of ['localhost:1234','[::1]:9229','::1:9229','a:00123','a:1:123'])assert.equal(isTcpAdapterSpec(spec),true,spec);
 for(const spec of ['',null,{},'node','tcp://localhost:1','/tmp/foo:1','a:123\n'])assert.equal(isTcpAdapterSpec(spec),false,String(spec));
});
