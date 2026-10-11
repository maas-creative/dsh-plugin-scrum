import test from 'node:test';import assert from 'node:assert/strict';import {resolveMemoryPolicy} from './memory-settings.mjs';
test('pinned memory schema defaults and per-agent nested precedence',()=>{const defaults=resolveMemoryPolicy();assert.equal(defaults.reflection.trigger.step_count,25);assert.equal(defaults.recall.max_items,2);assert.equal(defaults.recall.query_expansion,false);const input={reflection:{trigger:{step_count:40,on_compaction:false}},recall:{event_caps:{tool_args:300}},agents:{executor:{enabled:false,reflection:{trigger:{step_count:7}},recall:{query_expansion:true,event_caps:{assistant:80}}}}};const own=resolveMemoryPolicy(input,'executor'),other=resolveMemoryPolicy(input,'planner');assert.equal(own.enabled,false);assert.deepEqual(own.reflection.trigger,{step_count:7,on_compaction:false});assert.deepEqual(own.recall.event_caps,{tool_args:300,result_head:600,assistant:80,prompt:4000});assert.equal(own.recall.query_expansion,true);assert.equal(other.recall.query_expansion,false);assert.equal(other.reflection.trigger.step_count,40);assert.throws(()=>resolveMemoryPolicy({reflection:{trigger:{step_count:-1}}}));assert.throws(()=>resolveMemoryPolicy({recall:{invented:true}}));assert.equal(input.reflection.trigger.step_count,40)});

test('memory settings reject unsafe budgets and isolate inherited policy objects',()=>{
  for (const settings of [{dream:{auto_select_max:11}},{dream:{idle_minutes:.5}},{dream:{min_hours_between:0}},{dream:{auto_select_max_chars:9999}},{people:{max_entries:101}},{people:{max_entry_chars:49}},{recall:{max_items:6}},{agents:{worker:{reflection:{sandbox:'invented'}}}},{reflection:{trigger:{unknown:true}}}]) assert.throws(()=>resolveMemoryPolicy(settings));
  assert.equal(resolveMemoryPolicy({projection:{max_entries_per_directory:0,max_bytes:0}}).projection.max_bytes,0);
  const input={agents:{worker:{recall:{event_caps:{assistant:17}}}}};
  const a=resolveMemoryPolicy(input,'worker');a.recall.event_caps.prompt=1;
  assert.equal(resolveMemoryPolicy(input,'worker').recall.event_caps.prompt,4000);
  assert.equal(resolveMemoryPolicy(input,'toString').enabled,true);
  assert.equal(input.agents.worker.recall.event_caps.assistant,17);
});

test('explicit undefined keeps defaults while zero disables step triggers and recall excerpts',()=>{
 const policy=resolveMemoryPolicy({enabled:undefined,reflection:{trigger:{step_count:0}},recall:{event_caps:{assistant:0}}});
 assert.equal(policy.enabled,true);assert.equal(policy.reflection.trigger.step_count,0);assert.equal(policy.recall.event_caps.assistant,0);assert.equal(policy.recall.event_caps.prompt,4000);
});
