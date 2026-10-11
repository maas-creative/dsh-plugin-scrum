import test from 'node:test';
import assert from 'node:assert/strict';
import {selectRecallCandidates} from './independent/recall-selector.mjs';

test('lexical recall uses expansions, excludes surfaced evidence, and keeps the matched passage',()=>{
 const documents=[{path:'reference/release.md',description:'Release process',body:'x'.repeat(1200)+' canary rollout protects delivery receipts'},{path:'reference/fruit.md',description:'Fruit',body:'apples and oranges'}];
 assert.deepEqual(selectRecallCandidates(documents,['deploy']),[]);
 const result=selectRecallCandidates(documents,['deploy'],{expansions:{synonyms:['rollout']}});
 assert.equal(result.length,1);assert.equal(result[0].path,'reference/release.md');assert.match(result[0].excerpt,/rollout/);assert(result[0].excerpt.length<=800);
 assert.deepEqual(selectRecallCandidates(documents,['rollout'],{surfaced:new Set(['reference/release.md'])}),[]);
});
test('CJK bigrams retrieve inflected Korean and Japanese while rejecting unrelated evidence',()=>{
 const documents=[{path:'kr',description:'계획',body:'계획서 작성 일정'},{path:'jp',description:'研究',body:'研究計画書と申請締切'},{path:'other',description:'Food',body:'unrelated apples'}];
 assert.equal(selectRecallCandidates(documents,['계획서는 어떻게?'])[0].path,'kr');
 assert.equal(selectRecallCandidates(documents,['研究計画書'])[0].path,'jp');
 assert(!selectRecallCandidates(documents,['研究計画書']).some(item=>item.path==='other'));
});
test('rank fusion in a large corpus preserves the relevant document and requested result count',()=>{
 const documents=Array.from({length:220},(_,index)=>({path:`noise/${index}`,description:'Noise',body:'fruit inventory'}));
 documents.push({path:'target',description:'Release verification',body:'canary rollback deployment checks'});
 const results=selectRecallCandidates(documents,['canary rollback'],{maxItems:1});assert.equal(results.length,1);assert.equal(results[0].path,'target');assert(Number.isFinite(results[0].score));
 assert.deepEqual(selectRecallCandidates(documents,['canary rollback'],{maxItems:0}),[]);
});
