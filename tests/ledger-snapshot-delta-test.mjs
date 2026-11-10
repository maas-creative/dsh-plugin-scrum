import test from 'node:test';import assert from 'node:assert/strict';import {compactLedgerSnapshots} from "../ledger-snapshot-delta.mjs";
const event=(ledger,now='2026-01-01T00:00:00Z')=>({role:'user',source:{kind:'agent-message'},content:[{type:'text',text:JSON.stringify({now,documents:[],ledger})}]});
test('ledger deltas reconstruct each original snapshot without changing user instructions',()=>{
 const large='fixture'.repeat(1000),a={tasks:[{id:'1',body:large}],projects:[{id:'p'}],notes:['first'],old:1},b={tasks:a.tasks,projects:a.projects,notes:['second'],newField:true},c={...b,notes:['third']};
 const human={role:'user',source:{kind:'user'},content:[{type:'text',text:'Never send externally'}]},input=[event(a),human,event(b),event(c)],copy=structuredClone(input),out=compactLedgerSnapshots(input);assert.deepEqual(input,copy);assert.deepEqual(out[1],human);let prior;
 const reconstructed=out.filter(m=>m!==human).map(m=>{const text=m.content[0].text,payload=JSON.parse(text.slice(text.indexOf('{'))),delta=payload.ledger.__dashboard_ledger_delta_v1;if(delta){const next={...prior,...delta.changed};for(const key of delta.removed)delete next[key];payload.ledger=next}prior=payload.ledger;return payload.ledger});
 assert.deepEqual(reconstructed,[a,b,c]);assert(out[2].content[0].text.length<input[2].content[0].text.length/4);assert(out[3].content[0].text.length<input[3].content[0].text.length/4);
});
test('unknown ledger shapes reset the delta base and remain untouched',()=>{
 const valid={tasks:[{body:'x'.repeat(1000)}],projects:[]},unknown={role:'user',source:{kind:'agent-message'},content:[{type:'text',text:JSON.stringify({ledger:{other:1}})}]};const input=[event(valid),unknown,event(valid)];const out=compactLedgerSnapshots(input);assert.deepEqual(out,input);
});
