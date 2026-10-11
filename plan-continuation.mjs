// OMO 59d23b5c: session-owned boulder selection, continuation cap and progress signature.
// Invalid or paused records remain completion blockers, but do not disable other owned plans.
export function planContinuation(workflows, previous={}) {
 const plans=workflows.filter(w=>['boulder','atlas'].includes(w.mode)&&w.status==='active'&&w.planPath);
 if(!plans.length)return {applicable:false};
 const eligible=plans.filter(w=>!w.error&&!w.plan?.error&&w.plan?.checklist?.total&&!w.plan.complete);
 const plan=eligible.find(w=>w.id===previous.workflowId)||eligible.sort((a,b)=>(a.created||0)-(b.created||0)||a.id.localeCompare(b.id))[0];
 if(!plan)return plans.some(w=>w.error||w.plan?.error||!w.plan?.checklist?.total)?{applicable:true,blocked:'invalid-plan'}:{applicable:false};
 const signature=JSON.stringify([plan.id,plan.updated||plan.created,plan.plan.checklist.completed,plan.plan.checklist.total]);
 const count=previous.workflowId===plan.id||(previous.workflowId===undefined&&previous.signature===signature)?previous.count||0:0;
 if(count>=8)return {applicable:true,blocked:'continuation-cap-reached',workflowId:plan.id};
 if(previous.signature===signature)return {applicable:true,blocked:'stale-signature',workflowId:plan.id};
 return {applicable:true,next:{workflowId:plan.id,signature,count:count+1}};
}
