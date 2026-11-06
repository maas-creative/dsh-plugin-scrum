import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCompactionMode,compactionModeFor} from './compaction-mode.mjs';

test('main sessions opt into EoCC while unbound workers default to SAC',()=>{
 const main={},worker={};
 assert.equal(compactionModeFor(main),'sac');
 bindCompactionMode(main,'eocc');
 assert.equal(compactionModeFor(main),'eocc');
 assert.equal(compactionModeFor(worker),'sac');
});

test('explicit per-session mode overrides the default',()=>{
 assert.equal(compactionModeFor({options:{compactionMode:'eocc'}}),'eocc');
 assert.equal(compactionModeFor({options:{compactionMode:'sac'}}),'sac');
 assert.equal(compactionModeFor({options:{sessionKind:'main'}}),'eocc');
});
