import test from 'node:test';import assert from 'node:assert/strict';import {installSessionCompatibility} from './session-compat.mjs';
test('DSH records Scrum log-only metadata as ignorable while preserving native and foreign event semantics',async()=>{
 await installSessionCompatibility();const {Session}=await import('@deepseek-ai/dsh-session');const session=Session.create('compat-fixture');
 session.append('scrum/memory-notice',{id:'receipt'});session.append('foreign/required',{id:'foreign'});
 const events=session.snapshotEvents();assert.equal(events[0].ignorable,true);assert.equal(events[1].ignorable,undefined);assert.equal(events[0].surfaceOp,undefined);assert.equal((await installSessionCompatibility()).installed,false);
});
