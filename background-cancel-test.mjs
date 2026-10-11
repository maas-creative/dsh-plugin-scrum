import test from 'node:test';import assert from 'node:assert/strict';import {taskApi} from './task-api.mjs';
test('cancel all clears only owned pending dispatches and stops only active owned workers',async()=>{
 const settings=new Map([['scrumQueue:parent',[{taskId:'pending'}]],['scrumQueue:other',[{taskId:'peer'}]]]),stopped=[];
 const runtime={s:{setting:(key,fallback)=>settings.get(key)??fallback,set:(key,value)=>settings.set(key,value),snapshot:()=>({projects:[]})},list:()=>[{id:'active',parentSession:'parent',status:'running'},{id:'finished',parentSession:'parent',status:'done'},{id:'peer',parentSession:'other',status:'running'}],reports:{isBusy:async()=>false},stop:async id=>stopped.push(id),schedule(){}};
 const result=await taskApi(runtime,'background_cancel',{all:true},'parent');assert.deepEqual(stopped,['active']);assert.deepEqual(result.cancelledPendingTaskIds,['pending']);assert.deepEqual(settings.get('scrumQueue:parent'),[]);assert.deepEqual(settings.get('scrumQueue:other'),[{taskId:'peer'}]);await assert.rejects(taskApi(runtime,'background_cancel',{taskId:'peer'},'parent'),/この親/);await assert.rejects(taskApi(runtime,'background_cancel',{taskId:'finished'},'parent'),/running or pending/);
 runtime.reports.isBusy=async()=>true;assert.equal((await taskApi(runtime,'background_cancel',{taskId:'active'},'parent')).queued,true);assert.deepEqual(settings.get('scrumCancelQueue:parent'),['active']);assert.deepEqual(stopped,['active']);
});

test('individual pending cancellation and retrying cancellation retain peer queues',async()=>{
 const {backgroundCancel}=await import('./background-cancel.mjs'),settings=new Map([['scrumQueue:p',[{taskId:'queued'},{taskId:'keep'}]],['scrumQueue:other',[{taskId:'queued'}]]]),stopped=[];
 const runtime={s:{setting:(key,fallback)=>settings.get(key)??fallback,set:(key,value)=>settings.set(key,value)},list:()=>[{id:'retry',parentSession:'p',status:'retrying'},{id:'foreign',parentSession:'other',status:'running'}],reports:{isBusy:async()=>false},stop:async id=>stopped.push(id)};
 assert.deepEqual((await backgroundCancel(runtime,{task_id:'queued'},'p')).cancelledPendingTaskIds,['queued']);assert.deepEqual(settings.get('scrumQueue:p'),[{taskId:'keep'}]);assert.deepEqual(settings.get('scrumQueue:other'),[{taskId:'queued'}]);
 await backgroundCancel(runtime,{taskId:'retry'},'p');assert.deepEqual(stopped,['retry']);await assert.rejects(backgroundCancel(runtime,{taskId:'foreign'},'p'),/この親/);
});
