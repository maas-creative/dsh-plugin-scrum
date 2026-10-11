import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeTextEdits} from './independent/lsp-text-edits.mjs';
const edit=(line,start,end,newText)=>({range:{start:{line,character:start},end:{line,character:end}},newText});
test('independent LSP edits preserve CRLF and UTF16 coordinates and validate all edits before mutation',()=>{
 const source='日本😀x\r\nsecond\r\n';assert.equal(normalizeTextEdits(source,[edit(0,4,5,'!'),edit(1,0,6,'done')]).text,'日本😀!\r\ndone\r\n');
 assert.throws(()=>normalizeTextEdits(source,[edit(0,3,4,'bad')]),/surrogate/);
 assert.throws(()=>normalizeTextEdits(source,[edit(0,0,2,'a'),edit(0,1,4,'b')]),/Overlapping/);
 assert.throws(()=>normalizeTextEdits(source,[edit(0,0,6,'bad')]),/outside line/);
 assert.throws(()=>normalizeTextEdits(source,[edit(9,0,0,'bad')]),/outside document/);
 assert.throws(()=>normalizeTextEdits(source,[edit(0,2,0,'bad')]),/Reversed/);
 assert.equal(normalizeTextEdits('',[edit(0,0,0,'created')]).text,'created');
 assert.equal(normalizeTextEdits('x',[edit(0,0,0,'a'),edit(0,0,0,'b')]).text,'abx');
});
