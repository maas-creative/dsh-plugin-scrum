import test from 'node:test';import assert from 'node:assert/strict';import {extractLookAtDocument} from './look-at-media.mjs';
test('complete JSON preserves long lines and strings that resemble native read truncation markers',async()=>{
 const source=JSON.stringify({fact:'confirmed',literal:'Output capped; Use offset=; more lines remain',long:'x'.repeat(10000),integer:9007199254740991});
 const result=await extractLookAtDocument({data:Buffer.from(source),mediaType:'application/json'});assert.equal(result.text,source);assert.deepEqual(result.images,[]);
 await assert.rejects(extractLookAtDocument({data:Buffer.from(JSON.stringify({long:'x'.repeat(512*1024)})),mediaType:'application/json'}),/refusing truncated/);
});
