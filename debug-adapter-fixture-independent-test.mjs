import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {DapFrameParser} from './independent/debug-adapter-framing.mjs';
test('independent synthetic adapter verifies real stdio request/response and large variable output',()=>{
 const commands=['initialize','launch','setBreakpoints','configurationDone','threads','stackTrace','scopes','variables','evaluate','continue','unsupported'];
 const input=Buffer.concat(commands.map((command,index)=>{const body=JSON.stringify({seq:index+1,type:'request',command,arguments:{breakpoints:[{line:2}]}});return Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);}));
 const result=spawnSync(process.execPath,['skills/debugging/references/scripts/fixture-adapter.mjs'],{input,timeout:5000});assert.equal(result.status,0,result.stderr.toString());
 const messages=new DapFrameParser().push(result.stdout),responses=messages.filter(x=>x.type==='response');assert.equal(responses.length,commands.length);
 assert.equal(responses.find(x=>x.command==='variables').body.variables.length,250);assert.equal(responses.find(x=>x.command==='evaluate').body.result,'42');assert.equal(responses.at(-1).success,false);
 assert(messages.some(x=>x.event==='initialized'));assert(messages.some(x=>x.event==='stopped'));
 for(const [index,message] of responses.entries())assert.equal(message.request_seq,index+1);
});
