import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {estimateSystemTokens,validateDreamTokenBudget} from './independent/memory-budget.mjs';
import {readExpansions,chooseRecallStrategy,corpusCjkShare} from './independent/recall-policy.mjs';

test('system estimate includes nested markdown bytes but not symlinks or other files',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'scrum-budget-'));try{
  assert.deepEqual(await estimateSystemTokens(directory),{totalBytes:0,totalTokens:0,files:[]});
  await mkdir(join(directory,'system/nested'),{recursive:true});
  await writeFile(join(directory,'system/a.md'),'日本語');await writeFile(join(directory,'system/nested/b.md'),'12345');
  await writeFile(join(directory,'outside.md'),'private');await symlink(join(directory,'outside.md'),join(directory,'system/link.md'));
  await writeFile(join(directory,'system/not-memory.txt'),'123456789');
  const estimate=await estimateSystemTokens(directory);assert.equal(estimate.totalBytes,14);assert.equal(estimate.totalTokens,5);assert.equal(estimate.files.length,2);
 }finally{await rm(directory,{recursive:true,force:true})}
});
test('pressure compression requires strictly below target and rejects invalid measurements',()=>{
 assert.equal(validateDreamTokenBudget({origin:'pressure',totalTokens:99,targetTokens:100}).status,'valid');
 assert.equal(validateDreamTokenBudget({origin:'pressure',totalTokens:100,targetTokens:100}).status,'budget_not_met');
 assert.equal(validateDreamTokenBudget({origin:'idle',totalTokens:200,targetTokens:100}).status,'valid');
 assert.throws(()=>validateDreamTokenBudget({origin:'pressure',totalTokens:NaN,targetTokens:100}));
});
test('recall routing recognizes CJK and large corpora and expansion bounds cannot be bypassed',()=>{
 assert.equal(chooseRecallStrategy([{description:'',body:'English'}],['日本語']),'bm25');
 assert.equal(corpusCjkShare([{description:'',body:'日本語'}]),1);
 assert.equal(chooseRecallStrategy(Array(200).fill({description:'',body:'English'}),['English']),'hybrid');
 assert.equal(chooseRecallStrategy([{description:'',body:'English'}],['English']),'substring');
 assert.match(readExpansions({synonyms:Array(17).fill('a')}),/at most 16/);
 assert.equal(typeof readExpansions({synonyms:['a'.repeat(81)]}),'string');
 const input={related:['topic'],note_line:'hint'},result=readExpansions(input);result.related.push('new');assert.deepEqual(input.related,['topic']);assert.equal(result.noteLine,'hint');
});
