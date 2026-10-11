// Native goal persistence is shared with DSH; Scrum alone admits ledger-aware turns.
const ref=goal=>({id:goal.id,revision:goal.revision});
export async function syncNativeGoal(ctx,agent,state,binding){
 if(!ctx.goals)throw Error('DSH native goal service is unavailable');
 if(typeof state?.goal!=='string'||!state.goal.trim())return {supported:true,goal:ctx.goals.get(agent)||null,binding:binding||null,driver:'scrum'};
 let goal=ctx.goals.get(agent);
 if(binding&&!goal||goal&&(!binding||goal.id!==binding.id||goal.revision!==binding.revision))throw Error('Native goal changed outside Scrum; reconcile before continuing');
 if(goal&&binding.startedAt!==state.startedAt){ctx.goals.clear(agent,ref(goal));goal=null;}
 if(!goal){goal=ctx.goals.create(agent,{objective:state.goal});ctx.goals.disarm(agent)}
 else if(goal.objective!==state.goal)goal=ctx.goals.edit(agent,ref(goal),{objective:state.goal});
 const phase=state.phase==='completed'?'complete':['paused','stopped','cancelled'].includes(state.phase)?'paused':state.phase==='blocked'?'blocked':'active';
 if(goal.phase==='complete'&&phase!=='complete')throw Error('Completed native goal cannot continue');
 if(goal.phase!==phase){
  if(phase==='complete'){if(!state.finalChecks?.length||state.finalChecks.some(c=>c.verified!==true))throw Error('Verified final checks required before native completion');goal=ctx.goals.complete(agent,ref(goal))}
  else if(phase==='active')goal=ctx.goals.resume(agent,ref(goal));
  else {if(goal.phase!=='active')goal=ctx.goals.resume(agent,ref(goal));goal=phase==='paused'?ctx.goals.pause(agent,ref(goal)):ctx.goals.block(agent,ref(goal),{code:'scrum-verification-pending',message:'Scrum ledger has unresolved work or verification'});}
 }
 goal=ctx.goals.disarm(agent)||goal;
 await ctx.sessions.flush(agent.session);
 return {supported:true,goal,binding:{...ref(goal),startedAt:state.startedAt},driver:'scrum'};
}
export async function syncPlannerGoal(planner,coordinator,parent){
 const state=coordinator.state(parent);if(!state.goal)return null;
 const session=planner.parentSession(parent),key='scrumNativeGoal:'+parent;
 const rpc=planner.connection.path===session.path&&planner.connection.rpc&&!planner.connection.rpc.error?planner.connection.rpc:planner.io.dshRpc({cwd:planner.dir,sessionPath:session.path,planner:true,scrum:true});
 try{const result=await rpc.call('dsh_goal_sync',{state,binding:planner.s.setting(key,null)},true);planner.s.set(key,result.binding);return result}finally{if(rpc!==planner.connection.rpc)rpc.stop()}
}

// Serialize the complete binding read/mutate/flush/commit transaction per parent.
// A native mutation from another authority still mismatches the stored revision.
export function createNativeGoalSynchronizer(ctx,{agentFor,stateFor,readBinding,writeBinding}){
 const pending=new Map();
 return id=>{const previous=pending.get(id)||Promise.resolve();const work=previous.catch(()=>{}).then(async()=>{const result=await syncNativeGoal(ctx,agentFor(id),stateFor(id),readBinding(id));await writeBinding(id,result.binding);return result});pending.set(id,work);work.finally(()=>{if(pending.get(id)===work)pending.delete(id)}).catch(()=>{});return work};
}
