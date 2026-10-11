import test from 'node:test';
import assert from 'node:assert/strict';
import {gatewayCatalogFacts,correlatePublicModelCapabilities,correlateGatewayPrices} from './independent/gateway-catalog.mjs';

test('independent catalog keeps exact provider IDs and does not substitute gateway billing', () => {
  const row={id:'vendor/model',status:'active',context_window:1000,modalities:{input:['text'],output:['text']},endpoints:['chat_completions']};
  const facts=gatewayCatalogFacts({data:[row,{...row,id:'vendor/model-other'}]});
  const result=correlatePublicModelCapabilities(facts,{data:[{id:row.id,pricing:{prompt:'999'},top_provider:{max_completion_tokens:200},supported_parameters:['reasoning']}]});
  assert.equal(result[0].maxOutputTokens,200);
  assert.equal(result[0].reasoning,true);
  assert.equal(result[0].gatewayPricing,null);
  assert.equal(result[1].maxOutputTokens,null);
  assert.equal(result[1].reasoning,null);
  assert.equal(result[1].capabilitySource,null);
  assert.equal('pricing' in result[0],false);
  assert.throws(()=>gatewayCatalogFacts({data:[row,row]}),/duplicate/);
  assert.throws(()=>gatewayCatalogFacts({data:[{...row,context_window:-1}]}),/context/);
  assert.equal(gatewayCatalogFacts({data:[{...row,context_window:null}]})[0].contextWindow,null);
});

test('official gateway prices preserve route ambiguity, units, discounts and observation time', () => {
  const observedAt='2026-10-11T00:00:00.000Z';
  const base={provider:'direct',modelOwner:'vendor',modelName:'model',inputCostPerToken:0.000001,outputCostPerToken:0.000003};
  const rows=correlateGatewayPrices([{id:'vendor/model'},{id:'vendor/model-other'}],{
    direct:{...base,pricing:{current:{effectivePrice:{inputCostPerToken:0.0000005}},next:{startsAt:'later'}}},
    alternate:{...base,provider:'alternate',inputCostPerToken:0.000002},
  },observedAt);
  assert.equal(rows[0].gatewayPricing.length,2);
  assert.equal(rows[0].gatewayPricing[0].list.inputCostPerToken,0.000001);
  assert.equal(rows[0].gatewayPricing[0].effective.inputCostPerToken,0.0000005);
  assert.equal(rows[0].gatewayPricing[0].effective.outputCostPerToken,null);
  assert.equal(rows[0].gatewayPricing[0].observedAt,observedAt);
  assert.deepEqual(rows[0].gatewayPricing[0].scheduledChanges,{startsAt:'later'});
  assert.deepEqual(rows[1].gatewayPricing,[]);
  assert.throws(()=>correlateGatewayPrices([],{x:{...base,inputCostPerToken:-1}},observedAt),/price/);
  assert.throws(()=>correlateGatewayPrices([],{},'bad time'),/time/);
});
