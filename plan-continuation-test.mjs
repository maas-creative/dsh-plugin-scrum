import test from 'node:test';
import assert from 'node:assert/strict';
import {planContinuation} from './plan-continuation.mjs';
const plan=(id,completed=0)=>({id,mode:'boulder',status:'active',planPath:id+'.md',created:1,plan:{complete:false,checklist:{completed,total:2}}});
test('invalid and paused plans cannot suppress another owned continuation',()=>{
 const broken={...plan('broken'),plan:{error:'missing'}};
 const paused={...plan('paused'),status:'paused'};
 const next=planContinuation([broken,paused,plan('valid')]);
 assert.equal(next.next.workflowId,'valid');
 assert.equal(planContinuation([broken]).blocked,'invalid-plan');
 assert.equal(planContinuation([paused]).applicable,false);
});
test('continuation stays bound to selected work and counts independently',()=>{
 const first=planContinuation([plan('a'),plan('b')]).next;
 assert.equal(first.workflowId,'a');
 assert.equal(planContinuation([plan('a'),plan('b',1)],first).blocked,'stale-signature');
 const progressed=planContinuation([plan('a',1),plan('b')],first).next;
 assert.equal(progressed.count,2);
 assert.equal(planContinuation([plan('a',1)],{...progressed,count:8}).blocked,'continuation-cap-reached');
 const switched=planContinuation([plan('b')],{...progressed,count:8}).next;
 assert.equal(switched.workflowId,'b');assert.equal(switched.count,1);
});
