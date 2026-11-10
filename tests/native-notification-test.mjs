import test from 'node:test';
import assert from 'node:assert/strict';
test('durable wake uses the native followup once and recovers after receipt write interruption',async()=>{
 const {recordParentWake}=await import("../native-notification.mjs");const events=[],queued=[];let fail=true,completed=0;const agent={status:'idle',session:{id:'parent',snapshotEvents:()=>events},inbox:{nextStep:[],nextTurn:[]},followup:message=>{queued.push(message);events.push({type:'user/message',data:message})}};const ctx={sessions:{flush:async()=>{if(fail)throw Error('interrupted')}}},store={run:()=>completed++},message=value=>value;
 await assert.rejects(recordParentWake(ctx,agent,store,{batchId:'synthetic-batch',message:'continue'},message),/interrupted/);fail=false;
 const result=await recordParentWake(ctx,agent,store,{batchId:'synthetic-batch',message:'continue'},message);assert.equal(queued.length,1);assert.equal(result.alreadyPresent,true);assert.equal(completed,1);
});
