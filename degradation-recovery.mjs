import {registerPreemptiveDegradation} from './preemptive-degradation.mjs';
import {sourceHookEnabled} from './source-hook-policy.mjs';
import {registerUnstableBabysitter} from './unstable-babysitter.mjs';
import {compactionCheckpoint} from './compaction-state.mjs';
import {agentRole,bindAgentRole} from './agent-role.mjs';
export const NO_OUTPUT_THRESHOLD=5,RECOVERY_COOLDOWN_MS=60000,RECENT_COMPACTION_MS=600000;
const registrations=new WeakMap();
const meaningful=part=>part.type==='text'?!!part.text?.trim():['thinking','reasoning','tool','tool_use','tool_call'].includes(part.type);
export function hasAssistantOutput(message){return typeof message?.content==='string'?!!message.content.trim():(message?.content||[]).some(meaningful)}
export function readDegradationState(agent){return agent.session.snapshotEvents().filter(event=>event.type==='scrum/degradation-state').at(-1)?.data||{noOutputCount:0}}
const fixed=route=>route?.model==='gpt-6.1-sol'&&route?.provider==='openai-codex'&&(!route.reasoningEffort||route.reasoningEffort==='low');
export async function restoreCompactionCheckpoint(ctx,agent,{reason='compacted',now=Date.now(),isStopped=()=>false,pendingQuestion=()=>false,enabled=()=>true}={}){
 if(!enabled(agent)||isStopped(agent)||pendingQuestion(agent)||agent.status==='disposed')return {restored:false,reason:'not-authorized-to-continue'};
 const checkpoint=compactionCheckpoint(agent);if(!checkpoint)return {restored:false,reason:'no-checkpoint'};
 const state=readDegradationState(agent);if(state.lastRecoveryAt!==undefined&&now-state.lastRecoveryAt<RECOVERY_COOLDOWN_MS)return {restored:false,reason:'cooldown'};
 const current=agent.session.requestHeader?.()?.config||agent.options||{};
 if(!fixed(checkpoint.route)||!fixed({provider:current.provider||checkpoint.route.provider,model:current.model||checkpoint.route.model,reasoningEffort:current.reasoningEffort||'low'}))return {restored:false,reason:'model-route-conflict'};
 // Restore metadata and narrow exposed tools. Never replay a tool or silently
 // route a request to another model; the native session keeps its request header.
 const generation=(state.recoveryGeneration||0)+1,id='compaction-recovery:'+checkpoint.epoch+':'+reason+':'+generation;
 const prior=agent.session.snapshotEvents().filter(event=>event.type==='scrum/compaction-recovery'&&event.data.id===id).at(-1);
 if(prior?.data.status==='completed')return {restored:true,reason:'already-recorded'};
 agent.session.append('scrum/compaction-recovery',{id,epoch:checkpoint.epoch,reason,status:'pending',at:now});await ctx.sessions.flush(agent.session);
 try{
  if(!enabled(agent)||isStopped(agent)||pendingQuestion(agent)||agent.status==='disposed'){agent.session.append('scrum/compaction-recovery',{id,epoch:checkpoint.epoch,reason,status:'skipped',at:now});await ctx.sessions.flush(agent.session);return {restored:false,reason:'not-authorized-to-continue'}}
  if(agentRole(agent)!==checkpoint.role)bindAgentRole(agent,checkpoint.role,checkpoint.policy);
  if(checkpoint.toolNames&&agent.ctx?.tools?.restrict){const tools=ctx.get?.('tools')||ctx.tools,globalNames=new Set(tools.schemas().map(tool=>tool.name));agent.ctx.tools.restrict({allow:checkpoint.toolNames.filter(name=>globalNames.has(name))})}
  const next={...state,noOutputCount:0,lastRecoveryAt:now,checkpointEpoch:checkpoint.epoch,recoveryGeneration:generation};agent.session.append('scrum/degradation-state',next);agent.session.append('scrum/compaction-recovery',{id,epoch:checkpoint.epoch,reason,status:'completed',at:now});await ctx.sessions.flush(agent.session);return {restored:true,reason};
 }catch(error){agent.session.append('scrum/degradation-state',{...state,lastRecoveryAt:now});agent.session.append('scrum/compaction-recovery',{id,epoch:checkpoint.epoch,reason,status:'uncertain',error:error.message,at:now});await ctx.sessions.flush(agent.session);return {restored:false,reason:'uncertain',error:error.message}}
}
export function registerDegradationRecovery(ctx,{runtime,now=Date.now,readConfiguration}={}){
 if(registrations.has(ctx))return registrations.get(ctx);
 const enabled=agent=>sourceHookEnabled(agent,'compaction-context-injector',readConfiguration);
 const work=new Map();let closed=false;
 const isStopped=agent=>{const events=agent.session.snapshotEvents(),last=events.filter(event=>event.type==='scrum/recovery-stop'||event.type==='scrum/recovery-human-resume').at(-1);const native=events.filter(event=>event.type==='user/message'&&event.data.source?.kind==='user'||event.type==='turn/end'&&event.data.reason?.kind==='aborted').at(-1);return native?.type==='turn/end'||last?.type==='scrum/recovery-stop'||['paused','stopped','completed'].includes(runtime?.state?.(agent.session.id)?.phase)};
 const pendingQuestion=agent=>{const view=ctx.sessionProjections?.snapshot?.(agent.session,['userQuestions'])?.values?.userQuestions;return !!view?.active?.length||!!runtime?.s?.setting?.('scrumParentWait:'+agent.session.id,{}).pendingQuestion};
 const enqueue=(agent,fn)=>{if(closed)return Promise.resolve();const previous=work.get(agent)||Promise.resolve(),job=previous.catch(()=>{}).then(fn).catch(error=>ctx.logger?.warn('Scrum degradation recovery: '+error.message)).finally(()=>{if(work.get(agent)===job)work.delete(agent)});work.set(agent,job);return job};
 ctx.on('agent/request',async({agent},next)=>{const config=await next();if(compactionCheckpoint(agent)&&!fixed(config))throw Error('Compaction recovery cannot change the fixed GPT 6.1 Sol low model route');return config});
 const observe=(session,event)=>{const agent=ctx.agents.get(session.id);if(!agent)return;
  if(event.type==='user/message'&&event.data.source?.kind==='user'){return enqueue(agent,()=>session.append('scrum/recovery-human-resume',{at:now()}))}
  if(event.type==='turn/end'&&event.data.reason?.kind==='aborted'){return enqueue(agent,()=>session.append('scrum/recovery-stop',{at:now()}))}
  if(event.type==='compaction/end'&&!event.data.error)return enqueue(agent,async()=>{const state=readDegradationState(agent);session.append('scrum/degradation-state',{...state,lastCompactedAt:now()});await restoreCompactionCheckpoint(ctx,agent,{now:now(),isStopped,pendingQuestion,enabled})});
  if(event.type!=='assistant/message'||!enabled(agent))return;
  return enqueue(agent,async()=>{const state=readDegradationState(agent),id=event.data.message?.id||String(event.seq);if(state.lastMessageId===id)return;const next={...state,lastMessageId:id,noOutputCount:hasAssistantOutput(event.data.message)?0:(state.noOutputCount||0)+1};session.append('scrum/degradation-state',next);if(next.noOutputCount>=NO_OUTPUT_THRESHOLD&&next.lastCompactedAt!==undefined&&now()-next.lastCompactedAt<RECENT_COMPACTION_MS){const decision=await restoreCompactionCheckpoint(ctx,agent,{reason:'no-output-tail',now:now(),isStopped,pendingQuestion,enabled});session.append('scrum/degradation-decision',{...decision,at:now()})}});
 };ctx.on('session/event',observe);
 ctx.on('agent/created',({agent})=>enqueue(agent,()=>{const state=readDegradationState(agent);return state.lastCompactedAt!==undefined&&now()-state.lastCompactedAt<RECENT_COMPACTION_MS?restoreCompactionCheckpoint(ctx,agent,{reason:'resume',now:now(),isStopped,pendingQuestion,enabled}):undefined}));
 ctx.effect?.(()=>()=>{closed=true;return Promise.allSettled([...work.values()])});
 const engine=ctx.get?.('compaction')||ctx.compaction;if(engine?.recoverPostCompaction)registerPreemptiveDegradation(ctx,engine,{now,readConfiguration});
 const babysitter=registerUnstableBabysitter(ctx,{runtime,now,isStopped,pendingQuestion,readConfiguration});
 const registration={isStopped,pendingQuestion,babysitter,observe:(agent,event)=>observe(agent.session,event),drain:()=>Promise.allSettled([...work.values()])};registrations.set(ctx,registration);return registration;
}
