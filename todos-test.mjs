import test from 'node:test';import assert from 'node:assert/strict';
import {initialTodos,normalizeTodos,reduceTodos,selectTodoWrite,registerTodos} from './todos.mjs';
import {rolePolicy} from './roles.mjs';
import {assertSupportedJsonSchema} from '@deepseek-ai/dsh-tools';
test('Todo replay retains cancelled status, priority, explicit clear and turn boundaries',()=>{
 const rows=normalizeTodos([{content:'Inspect source evidence',status:'in_progress',priority:'high'},{content:'Discard obsolete branch',status:'cancelled',priority:'low'}]);
 let state=reduceTodos(initialTodos(),{type:'todo/write',data:{todos:rows,scrum:{version:1,todos:rows}}});
 state=reduceTodos(state,{type:'turn/start'});assert.deepEqual(state.todos,rows);
 state=reduceTodos(state,{type:'todo/write',data:{todos:[]}});assert.deepEqual(state.todos,rows);
 state=reduceTodos(state,{type:'todo/write',data:{todos:[],scrum:{version:1,todos:[]}}});
 state=reduceTodos(state,{type:'todo/write',data:{todos:[{content:'old',status:'pending'}]}});assert.deepEqual(state.todos,[]);
});
test('compaction protects detailed todos from repeated bootstrap replacements until idle or detailed update',()=>{
 const rows=normalizeTodos([{content:'Verify output file',status:'pending',priority:'high'}]),bootstrap=normalizeTodos([{id:'orchestrate-plan',content:'Complete ALL implementation tasks',status:'pending',priority:'high'}]);
 let state=reduceTodos(initialTodos(),{type:'todo/write',data:{todos:rows,scrum:{version:1,todos:rows}}});state=reduceTodos(state,{type:'compaction/start'});state=reduceTodos(state,{type:'compaction/end',data:{}});
 for(let i=0;i<2;i++){const selected=selectTodoWrite(state,bootstrap);assert.equal(selected.preserved,true);state=reduceTodos(state,{type:'todo/write',data:{todos:selected.todos,scrum:{version:1,...selected}}})}
 assert.deepEqual(state.todos,rows);assert.equal(selectTodoWrite(reduceTodos(state,{type:'turn/end'}),bootstrap).preserved,false);
 assert.equal(selectTodoWrite(reduceTodos(state,{type:'compaction/end',data:{error:'failed'}}),bootstrap).preserved,false);
 assert.equal(selectTodoWrite(state,[]).preserved,false);
});
test('Todo schema validation rejects invalid priorities, duplicate ids and parallel in-progress work',()=>{
 assert.throws(()=>normalizeTodos([{content:'x',status:'pending',priority:1}]),/Invalid/);
 assert.throws(()=>normalizeTodos([{content:'x',status:'pending'}],{requirePriority:true}),/Invalid/);
 assert.equal(normalizeTodos([{content:'x',status:'pending'}])[0].priority,'medium');
 assert.throws(()=>normalizeTodos([{content:'x',status:'pending',id:'a'},{content:'y',status:'pending',id:'a'}]),/Duplicate/);
 assert.throws(()=>normalizeTodos([{content:'x',status:'in_progress'},{content:'y',status:'in_progress'}]),/one Todo/);
});
test('scoped Todo registration preserves denied roles and uses supported native schemas',async()=>{
 assert(rolePolicy('planner').allow.includes('todo_write'));
 const hooks=new Map(),tools=new Map();let state=initialTodos();
 const agent={ctx:{tools:{register:definition=>{assertSupportedJsonSchema(definition.parameters);tools.set(definition.name,definition)}}},session:{append:(type,data,options)=>{if(data.scrum)assert.equal(type,'todo/write');state=reduceTodos(state,{type,data})}}};
 const denied={ctx:{tools:{register:()=>assert.fail('Denied role gained Todo access')}},session:{header:{id:'denied'},append:()=>{},snapshotEvents:()=>[]}};
 const ctx={sessionProjections:{register:()=>{},snapshot:()=>({values:{scrumTodos:state}})},tools:{schemas:target=>target===agent?[{name:'todo_write'}]:[]},agents:{list:()=>[agent,denied]},on:(name,fn)=>hooks.set(name,fn),systemPrompt:{context:()=>{}}};
 registerTodos(ctx);assert.equal(tools.size,2);
 await tools.get('todo_write').execute({todos:[{content:'inspect receipt',status:'pending'}]},{agent});assert.equal(state.todos[0].priority,'medium');
 await assert.rejects(tools.get('todo_write').execute({todos:[]},{agent:denied}),/owner mismatch/);
});
