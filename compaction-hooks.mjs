import {compactLedgerSnapshots,createLedgerSnapshotCompactor} from './ledger-snapshot-delta.mjs';
import {shouldDeferForCache} from './cache-pressure.mjs';
import {sourceHookEnabled} from './source-hook-policy.mjs';
import {beginCompaction,endCompaction} from './compaction-state.mjs';
import {BasicCompactionEngine} from '@deepseek-ai/dsh-compaction-basic';
import {toolPairingBalancedBefore,toolPairingBalancedAfter} from '@deepseek-ai/dsh-compaction';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {loadClaudeHooksFor,runClaudeHooks,claudeHookPayload} from './claude-hooks.mjs';
// Use the SDK's supported summarize override; never mutate a routed request or session log.
export async function prepareCompactionInput(ctx,input,agent,signal,trigger='auto'){
 const result=await runClaudeHooks(await loadClaudeHooksFor(ctx,agent),'PreCompact',{...claudeHookPayload(ctx,agent),trigger},{signal});
 for(const warning of result.warnings)ctx.logger?.warn('Scrum PreCompact hook: '+warning);
 const messages=compactLedgerSnapshots(input.messages);
 if(!result.contexts.length)return messages.every((message,index)=>message===input.messages[index])?input:{...input,messages};
 return {...input,messages:[...messages,createUserMessage({content:[{type:'text',text:'Configured pre-compaction context:\n'+result.contexts.join('\n')}],source:{kind:'agent-message',form:'relay',senderSessionId:agent.session.id}})]};
}
export default class ScrumCompactionEngine extends BasicCompactionEngine {
 static inject=BasicCompactionEngine.inject;
 static Config=BasicCompactionEngine.Config;
 scrumPreCompact=true;
 triggers=new WeakMap();
 pressureInFlight=new WeakSet();
 lastPressure=new WeakMap();
 cacheDeferred=new WeakSet();
 constructor(ctx,config={}){
  const policies=config.modelPolicies??[];
  const glm={provider:'local-glm',model:'glm53-fast'};
  const modelPolicies=config.maxTokens!==undefined||!Array.isArray(policies)?policies:(policies.some(p=>p.provider===glm.provider&&p.model===glm.model)?policies.map(p=>p.provider===glm.provider&&p.model===glm.model&&p.maxTokens===undefined&&p.headroomTokens===undefined?{maxTokens:8192,...p}:p):[...policies,{...glm,maxTokens:8192}]);
  super(ctx,{thresholdRatio:0.65,...config,modelPolicies});
 }
 // Only optional source pressure compaction is switchable. Provider-confirmed
 // overflow and explicit compactNow retain the SDK's mandatory recovery path.

 async compactNow(agent,signal,sourceCommandId){this.triggers.set(agent,'manual');try{const result=await super.compactNow(agent,signal,sourceCommandId);if(result)this.cacheDeferred.delete(agent);return result}finally{this.triggers.delete(agent)}}
 async compactIfNeeded(agent,trigger,signal){
  const pressure=trigger==='pressure';
  if(pressure&&(!sourceHookEnabled(agent,'preemptive-compaction')||this.pressureInFlight.has(agent)||Date.now()-(this.lastPressure.get(agent)??-Infinity)<60000))return null;
  if(pressure){
   this.pressureInFlight.add(agent);
   try{if(await this.deferWarmPressure(agent,signal)){this.cacheDeferred.add(agent);this.ctx.logger?.info('Deferred one pressure compaction while the measured prefix cache is warm');return null}}
   catch(error){if(signal.aborted)throw error}
   finally{this.pressureInFlight.delete(agent)}
   this.pressureInFlight.add(agent);
  }
  this.triggers.set(agent,trigger);
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  const timer=pressure?setTimeout(()=>controller.abort(Error('Source preemptive compaction timed out after 300000ms')),300000):null;timer?.unref();
  try{const result=await this.compactWithBoundedInput(agent,trigger,controller.signal,()=>timer?.refresh());if(result){this.cacheDeferred.delete(agent);if(pressure)this.lastPressure.set(agent,Date.now())}return result}finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);this.triggers.delete(agent);if(pressure)this.pressureInFlight.delete(agent)}
 }

 async compactWithBoundedInput(agent,trigger,signal,onProgress=()=>{}){
  const session=agent.session,route=session.requestHeader()?.config;
  if(route?.provider!=='local-glm'||route.model!=='glm53-fast'||!session.surface?.nodes)return super.compactIfNeeded(agent,trigger,signal);
  const info=await this.ctx.llm.resolveModelInfo(route.provider,route.model,signal),window=info.context?.contextWindow;
  if(!Number.isSafeInteger(window)||window<=0)return super.compactIfNeeded(agent,trigger,signal);
  let measure=this.ctx.tokenMeter.measure(session),result=null;
  const policy=this.config.modelPolicies?.find(p=>p.provider===route.provider&&p.model===route.model);
  const threshold=Math.floor(Math.min(window*Math.min(.65,policy?.thresholdRatio??this.config.thresholdRatio),window-(route.maxTokens??info.defaultMaxTokens)-(policy?.headroomTokens??this.config.headroomTokens)));
  if(!Number.isSafeInteger(threshold)||threshold<=0)return super.compactIfNeeded(agent,trigger,signal);
  if(trigger==='pressure'&&measure.totalTokens<threshold)return null;
  const target=Math.floor(Math.min(threshold,window*.55));let budget=Math.floor(window*.35);
  for(let attempts=0;attempts<100;attempts++){
   signal.throwIfAborted();const nodes=session.surface.nodes,priced=measure.nodes;
   if(nodes.length!==priced.length||nodes.some((seq,i)=>seq!==priced[i]?.seq))throw Error('圧縮対象の履歴とトークン計測が一致しません');
   if(!nodes.length)break;
   const start=session.eventAt(nodes[0])?.type==='system/message'?1:0;
   if(start>=nodes.length||!toolPairingBalancedBefore(session,nodes[start]))break;
   let size=0,end=-1;const compactSnapshot=createLedgerSnapshotCompactor();
   for(let i=start;i<nodes.length-1;i++){const message=session.deriveEventMessage?.(session.eventAt(nodes[i])),compacted=message?compactSnapshot(message):null;const cost=compacted&&compacted!==message&&this.ctx.tokenMeter.estimateMessage?this.ctx.tokenMeter.estimateMessage(compacted):priced[i].tokens;const next=size+cost;if(next>budget&&end>start)break;size=next;if(toolPairingBalancedAfter(session,nodes[i]))end=i;if(size>=budget&&end>start)break}
   if(end<=start||end>=nodes.length-1)break;
   if(size>window*.5)throw Error('履歴の一まとまりが大きすぎるため、安全に分割できません');
   const before=measure.totalTokens;
   try{result=await this.compactRegion(nodes[start],nodes[end],agent,signal)}catch(error){
    const exceeded=error?.code==='CONTEXT_WINDOW_EXCEEDED'||error?.code==='MAX_TOKENS'||/maximum context length/i.test(String(error?.message||''));
    if(!signal.aborted&&exceeded&&budget>window*.1){budget=Math.floor(budget/2);continue}throw error;
   }
   onProgress();measure=this.ctx.tokenMeter.measure(session);
   if(measure.totalTokens>=before)throw Error('圧縮しても入力が短くなりませんでした');
   if(measure.totalTokens<target)return result;
  }
  if(result)return result;
  return super.compactIfNeeded(agent,trigger,signal);
 }

 async deferWarmPressure(agent,signal){
  const route=agent.session.requestHeader()?.config;
  if(route?.provider!=='local-glm'||route.model!=='glm53-fast')return false;
  const info=await this.ctx.llm.resolveModelInfo(route.provider,route.model,signal),measurement=this.ctx.tokenMeter.measure(agent.session);
  const window=info.context?.contextWindow,maxTokens=route.maxTokens??info.defaultMaxTokens,policy=this.config.modelPolicies.find(p=>p.provider===route.provider&&p.model===route.model);
  const pressureThreshold=Math.floor(Math.min(window*Math.min(.65,policy?.thresholdRatio??this.config.thresholdRatio),window-maxTokens-(policy?.headroomTokens??this.config.headroomTokens)));
  return shouldDeferForCache({route,events:agent.session.snapshotEvents(),currentTokens:measurement.totalTokens,contextWindow:window,maxTokens,pressureThreshold,alreadyDeferred:this.cacheDeferred.has(agent)});
 }

 async recoverPostCompaction(agent,signal){if(!sourceHookEnabled(agent,'preemptive-compaction'))return null;this.triggers.set(agent,'source-recovery');try{const result=await super.compactIfNeeded(agent,'context-overflow',signal);if(result)this.cacheDeferred.delete(agent);return result}finally{this.triggers.delete(agent)}}
 async summarize(input,agent,signal){
  if(['pressure','source-recovery'].includes(this.triggers.get(agent))&&!sourceHookEnabled(agent,'preemptive-compaction'))throw Error('Source preemptive compaction disabled before summarization')
  const epoch=await beginCompaction(agent,{ctx:this.ctx});let failure;
  try{const prepared=await prepareCompactionInput(this.ctx,input,agent,signal,this.triggers.get(agent)==='manual'?'manual':'auto');if(['pressure','source-recovery'].includes(this.triggers.get(agent))&&!sourceHookEnabled(agent,'preemptive-compaction'))throw Error('Source preemptive compaction disabled during hook I/O');return await super.summarize(prepared,agent,signal)}
  catch(error){failure=error;throw error}
  finally{try{await endCompaction(agent,epoch)}catch(error){if(!failure)throw error;this.ctx.logger?.warn('Scrum compaction cleanup failed: '+error.message)}}
 }
}
