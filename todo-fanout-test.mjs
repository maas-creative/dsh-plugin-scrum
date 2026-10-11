import test from 'node:test';import assert from 'node:assert/strict';import {registerTodoFanout,fanoutReminderState,todoMutationOperation} from './todo-fanout.mjs';
test('fanout accepted compaction and native shutdown reset, rejected compaction preserves once state',async()=>{
 const hooks={},events=[{type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'ulw Do not use subagents'}]}}],session={id:'s',header:{cwd:'/tmp'},snapshotEvents:()=>events,append:(type,data)=>events.push({type,data})},agent={session},ctx={on:(name,fn)=>hooks[name]=fn,agents:{list:()=>[agent]}};registerTodoFanout(ctx,{readConfiguration:()=>({})});
 const invoke=()=>hooks['tools/post-execute']({name:'todo_write',agent},{content:[{type:'text',text:JSON.stringify({operation:'append'})}]},async()=>({kind:'accept'}));assert.equal((await invoke()).content.length,2);assert.equal((await invoke()).content,undefined);
 hooks['session/event'](session,{type:'compaction/end',data:{accepted:false}});assert.equal((await invoke()).content,undefined);hooks['session/event'](session,{type:'compaction/end',data:{}});assert.equal((await invoke()).content.length,2);hooks['agent/disposed']({agent});assert.equal(fanoutReminderState(events).shown,false);
 assert.equal(todoMutationOperation({initialized:true,todos:[{id:'1'}]},{todos:[{id:'1'}]}),'update');
});

test('cold native incarnation resets stale persisted shown state without overriding human stop',async()=>{
 const events=[{type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'ulw Do not use subagents'}]}},{type:'scrum/todo-fanout',data:{action:'shown'}}],hooks={},session={id:'cold',header:{cwd:'/tmp'},snapshotEvents:()=>events,append:(type,data)=>events.push({type,data})};let agent={session};const ctx={on:(name,fn)=>hooks[name]=fn,agents:{list:()=>[agent]}};
 registerTodoFanout(ctx,{readConfiguration:()=>({})});const invoke=()=>hooks['tools/post-execute']({name:'todo_write',agent},{content:[{type:'text',text:'{"operation":"append"}'}]},async()=>({kind:'accept'}));assert.equal((await invoke()).content.length,2);assert.equal((await invoke()).content,undefined);
 // SDK flush happens before disposed callbacks: cold replay deliberately loses that reset.
 const durable=structuredClone(events);hooks['agent/disposed']({agent});events.splice(0,events.length,...durable);agent={session};hooks['agent/created']({agent});assert.equal((await invoke()).content.length,2);assert.equal((await invoke()).content,undefined);
 events.push({type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'/stop-continuation'}]}});agent={session};hooks['agent/created']({agent});assert.equal((await invoke()).content,undefined);assert.equal(fanoutReminderState(events).shown,false);
});
