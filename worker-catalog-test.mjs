import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultWorkerRoles,roles,roleInstruction,workerRoles} from './roles.mjs';
import {ScrumUiService} from './scrum-ui-host.mjs';

const service=options=>Object.assign(Object.create(ScrumUiService.prototype),options);

test('new Scrum worker catalog keeps the human thinking-to-action loop to five roles',()=>{
 assert.deepEqual(defaultWorkerRoles,['planner','researcher','executor','reviewer','validator']);
 assert.deepEqual(workerRoles({}),defaultWorkerRoles);
 assert.deepEqual(workerRoles({roles:{architect:{provider:'p',model:'m',reasoningEffort:'high'}}}),[...defaultWorkerRoles,'architect']);
 assert.ok(defaultWorkerRoles.every(role=>roles[role]?.instruction));
 assert.match(roleInstruction('executor',process.cwd()),/human's stated purpose|人間/);
});

test('Scrum settings expose model reasoning efforts and persist the selected effort',async()=>{
 let settings={default:{provider:'p',model:'one',reasoningEffort:'low'},roles:{}};
 const s=service({
  ctx:{llm:{listProviders:()=>[{id:'p'}],listModels:async()=>[{id:'one',name:'One'}],resolveModelInfo:async()=>({reasoning:{efforts:[{id:'low'},{id:'high'}]}})}},
  runtime:{s:{setting:(key,fallback)=>key==='workerModels'?structuredClone(settings):fallback,set:(key,value)=>{if(key==='workerModels')settings=value}}}
 });
 const view=await s.settings();
 assert.deepEqual(view.roles,defaultWorkerRoles);
 assert.deepEqual(view.catalog[0].models[0].reasoningEfforts,['low','high']);
 await s.saveModel({role:'reviewer',model:{provider:'p',model:'one',reasoningEffort:'high'}});
 assert.equal(settings.roles.reviewer.reasoningEffort,'high');
 await s.saveModel({role:'main',model:{provider:'p',model:'one',reasoningEffort:'low'}});
 assert.equal(settings.main.model,'one');
});
