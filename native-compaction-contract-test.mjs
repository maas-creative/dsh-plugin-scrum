import test from 'node:test';
import assert from 'node:assert/strict';
import Engine from './compaction-hooks.mjs';
import NativeEngine from '@deepseek-ai/dsh-compaction-basic';

test('Scrum compatibility entry uses the unchanged DSH compaction implementation',()=>{
 assert.equal(Engine,NativeEngine);
 assert.equal(Engine.prototype.compactNow,NativeEngine.prototype.compactNow);
 assert.equal(Engine.prototype.summarize,NativeEngine.prototype.summarize);
});
