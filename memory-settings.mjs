import {z} from 'zod';

// The defaults and field names are the persisted configuration contract.
// Validation and inheritance are implemented locally without the bundled schema.
const positive = z.number().int().min(1);
const nonnegative = z.number().int().min(0);
const label = z.string().min(1);
const sections = {
  reflection: z.strictObject({enabled:z.boolean(), trigger:z.strictObject({step_count:nonnegative,on_compaction:z.boolean()}), merge:z.enum(['auto','integration']), category:label, timeout_minutes:positive, sandbox:z.enum(['auto','required','off'])}),
  nudge: z.strictObject({enabled:z.boolean(),every_user_turns:positive}),
  facts: z.strictObject({enabled:z.boolean(),debounce_settles:positive}),
  dream: z.strictObject({enabled:z.boolean(),idle_minutes:nonnegative,min_hours_between:positive,shutdown_launch:z.boolean(),auto_select_max:positive.max(10),auto_select_max_chars:positive.min(10000)}),
  people: z.strictObject({enabled:z.boolean(),max_entries:positive.max(100),max_entry_chars:positive.min(50).max(500)}),
  soul: z.strictObject({edit_notice:z.boolean()}),
  write_notice: z.strictObject({enabled:z.boolean()}),
  sync: z.strictObject({enabled:z.boolean()}),
  search: z.strictObject({enabled:z.boolean()}),
  recall: z.strictObject({enabled:z.boolean(),max_items:positive.max(5),category:label,event_caps:z.strictObject({tool_args:nonnegative,result_head:nonnegative,assistant:nonnegative,prompt:nonnegative}),sidecar_max_tokens:positive,max_concurrent_wakes:positive,tool_budget:positive,query_expansion:z.boolean()}),
  projection: z.strictObject({max_entries_per_directory:nonnegative,max_bytes:nonnegative}),
};
const defaults = {
  enabled:true,agent:'auto',
  reflection:{enabled:true,trigger:{step_count:25,on_compaction:true},merge:'auto',category:'quick',timeout_minutes:15,sandbox:'auto'},
  nudge:{enabled:true,every_user_turns:10},facts:{enabled:true,debounce_settles:4},
  dream:{enabled:true,idle_minutes:30,min_hours_between:24,shutdown_launch:true,auto_select_max:5,auto_select_max_chars:150000},
  people:{enabled:true,max_entries:40,max_entry_chars:200},soul:{edit_notice:true},write_notice:{enabled:true},sync:{enabled:true},search:{enabled:true},
  recall:{enabled:true,max_items:2,category:'quick',event_caps:{tool_args:400,result_head:600,assistant:1500,prompt:4000},sidecar_max_tokens:48000,max_concurrent_wakes:2,tool_budget:8,query_expansion:false},
  projection:{max_entries_per_directory:40,max_bytes:24576},compile_warn_tokens:30000,
};
const partialSections = Object.fromEntries(Object.entries(sections).map(([key,schema])=>[key,schema.partial()]));
partialSections.reflection = partialSections.reflection.extend({trigger:sections.reflection.shape.trigger.partial().optional()});
partialSections.recall = partialSections.recall.extend({event_caps:sections.recall.shape.event_caps.partial().optional()});
const overrideSchema = z.strictObject({enabled:z.boolean(),agent:label,...partialSections,compile_warn_tokens:positive}).partial();
const settingsSchema = overrideSchema.extend({agents:z.record(z.string(),overrideSchema).optional()});

function definedFields(value) {
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).filter(([,v])=>v!==undefined).map(([key,v])=>[key,definedFields(v)]));
}

function merge(base, update) {
  const result = {...base,...update};
  for (const key of Object.keys(sections)) result[key] = {...base[key],...update[key]};
  result.reflection.trigger = {...base.reflection.trigger,...update.reflection?.trigger};
  result.recall.event_caps = {...base.recall.event_caps,...update.recall?.event_caps};
  return result;
}

export function resolveMemoryPolicy(settings, identity) {
  const parsed = definedFields(settingsSchema.parse(settings ?? {}));
  const root = merge(structuredClone(defaults), parsed);
  root.agents = parsed.agents ?? {};
  const override = Object.hasOwn(root.agents,identity) ? root.agents[identity] : {};
  return merge(root,override);
}
