import test from 'node:test';
import assert from 'node:assert/strict';
import {mayRetryModel,fallbackModels} from "../models.mjs";

test('fallback respects task precedence and never retries after tool effects or authentication failure',()=>{
 const backup={provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'low'};
 const settings={fallbacks:{default:[backup],roles:{reviewer:[]},tasks:{special:[backup]}}};
 assert.deepEqual(fallbackModels(settings,'executor','ordinary'),[backup]);assert.deepEqual(fallbackModels(settings,'reviewer','ordinary'),[]);assert.deepEqual(fallbackModels(settings,'reviewer','special'),[backup]);
 assert.equal(mayRetryModel({error:'503 model unavailable',toolEvidence:[]}),true);assert.equal(mayRetryModel({error:'503 model unavailable',toolEvidence:[{toolName:'write'}]}),false);assert.equal(mayRetryModel({error:'503 model unavailable',toolStarted:true,toolEvidence:[]}),false);assert.equal(mayRetryModel({error:'401 authentication failed',toolEvidence:[]}),false);assert.equal(mayRetryModel({error:'ECONNREFUSED',toolEvidence:[]}),true);assert.equal(mayRetryModel({error:'fetch failed: 401 unauthorized',toolEvidence:[]}),false);
});
