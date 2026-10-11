import {sourceHookEnabled} from './source-hook-policy.mjs';
import {ProcessNotices} from './process-notices.mjs';
export const BABYSITTER_TIMEOUT_MS=120000,BABYSITTER_COOLDOWN_MS=300000;
export function thinkingOnly(messages){const last=[...messages].reverse().find(message=>message.role==='assistant');if(!last||!Array.isArray(last.content))return false;return last.content.some(part=>['thinking','reasoning'].includes(part.type))&&!last.content.some(part=>part.type==='text'&&part.text?.trim()||['tool','tool_use','tool_call'].includes(part.type))}
export function thinkingSummary(messages){return messages.filter(message=>message.role==='assistant').flatMap(message=>Array.isArray(message.content)?message.content:[]).filter(part=>['thinking','reasoning'].includes(part.type)).map(part=>part.thinking||part.text||'').join('\n').trim().slice(0,500)||'(No thinking trace available)'}
export function registerUnstableBabysitter(ctx,{runtime,timeoutMs=BABYSITTER_TIMEOUT_MS,cooldownMs=BABYSITTER_COOLDOWN_MS,now=Date.now,isStopped=()=>false,pendingQuestion=()=>false,readConfiguration}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<0||!Number.isFinite(cooldownMs)||cooldownMs<0)throw Error('Invalid babysitter timing');
 const enabled=agent=>sourceHookEnabled(agent,'unstable-agent-babysitter',readConfiguration);
 const notices=new ProcessNotices(ctx),work=new Map();let closed=false;
 const freshHuman=agent=>{const human=agent.session.snapshotEvents().filter(event=>event.type==='user/message'&&event.data.source?.kind==='user').at(-1);return !!human&&now()-human.time<=2000};
 const inspect=async agent=>{
  const at=now(),id=agent.session.id;
  if(!enabled(agent)||closed||!runtime||agent.status!=='idle'||isStopped(agent)||pendingQuestion(agent))return {reminders:0};
  if(freshHuman(agent))return {reminders:0};
  let reminders=0;
  for(const task of runtime.list().filter(task=>task.parentSession===id&&task.status==='running')){
   const child=ctx.agents.get(task.runId);if(child&&pendingQuestion(child))continue;
   const operation=runtime.s.setting('pi-send:'+(task.requestId||task.id),{}),lastActivity=Math.max(Number(task.lastActivityAt)||0,Number(operation.lastEventAt)||0,Number(task.started)||Number(task.created)||0);
   if(!lastActivity||at-lastActivity<timeoutMs)continue;
   const prior=agent.session.snapshotEvents().filter(event=>event.type==='scrum/babysitter-state'&&event.data.taskId===task.id).at(-1)?.data;
   if(prior&&at-prior.lastReminderAt<cooldownMs)continue;
   let messages;try{messages=await runtime.pi.readMessages(task.runId)}catch(error){ctx.logger?.warn('Scrum babysitter transcript unavailable: '+error.message);continue}
   if(task.isUnstableAgent!==true&&!thinkingOnly(messages))continue;
   // Check again after transcript I/O; a stop or a question can arrive meanwhile.
   if(!enabled(agent)||closed||agent.status!=='idle'||isStopped(agent)||pendingQuestion(agent)||freshHuman(agent)||child&&pendingQuestion(child))continue;
   const batchSeq=(prior?.generation||0)+1,receipt={taskId:task.id,lastReminderAt:at,generation:batchSeq,status:'reserved'};agent.session.append('scrum/babysitter-state',receipt);await ctx.sessions.flush(agent.session);
   if(!enabled(agent)||closed||agent.status!=='idle'||isStopped(agent)||pendingQuestion(agent)||freshHuman(agent)||child&&pendingQuestion(child)){agent.session.append('scrum/babysitter-state',{...receipt,status:'skipped'});await ctx.sessions.flush(agent.session);continue}
   const reminder={id:'babysitter:'+task.id,batchSeq,mode:'idle',status:'reminder',taskId:task.id,sessionId:task.runId,idleMs:at-lastActivity,thinkingSummary:thinkingSummary(messages),message:'This worker has been quiet or produced only thinking. Inspect background_output with full_session, include_thinking, include_tool_results and message_limit=50. background_cancel is available if the parent decides to cancel. This is a reminder only; no action or model change was taken.'};
   try{await notices.enqueue(agent,reminder);let wakeRequested=false;const state=runtime.state?.(id);if(enabled(agent)&&state?.active===true&&runtime.requestPlan&&agent.status==='idle'&&!isStopped(agent)&&!pendingQuestion(agent)&&!freshHuman(agent)){wakeRequested=true;await runtime.requestPlan(id,state,{queueOnly:true})}agent.session.append('scrum/babysitter-state',{...receipt,status:'delivered',wakeRequested});await ctx.sessions.flush(agent.session);reminders++}catch(error){agent.session.append('scrum/babysitter-state',{...receipt,status:'uncertain',error:error.message});await ctx.sessions.flush(agent.session)}
  }return {reminders};
 };
 const check=agent=>{if(work.has(agent))return work.get(agent);const job=inspect(agent).finally(()=>work.delete(agent));work.set(agent,job);return job};
 ctx.on('agent/status',({agent,status})=>{if(status==='idle')void check(agent).catch(error=>ctx.logger?.warn('Scrum babysitter: '+error.message))});
 ctx.on('agent/created',({agent})=>enabled(agent)?notices.drain(agent):undefined);
 ctx.effect?.(()=>{const timer=runtime&&ctx.agents.list?setInterval(()=>{for(const agent of ctx.agents.list())if(agent.status==='idle')void check(agent).catch(error=>ctx.logger?.warn('Scrum babysitter: '+error.message))},Math.max(1000,Math.min(timeoutMs||1000,5000))):null;timer?.unref();return ()=>{closed=true;if(timer)clearInterval(timer);return Promise.allSettled([...work.values(),notices.close()])}});
 return {check,drain:()=>Promise.allSettled([...work.values()])};
}
