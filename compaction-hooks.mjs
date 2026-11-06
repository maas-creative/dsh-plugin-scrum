import {compactLedgerSnapshots,createLedgerSnapshotCompactor} from './ledger-snapshot-delta.mjs';
import {shouldDeferForCache} from './cache-pressure.mjs';
import {sourceHookEnabled} from './source-hook-policy.mjs';
import {beginCompaction,endCompaction} from './compaction-state.mjs';
import {BasicCompactionEngine} from '@deepseek-ai/dsh-compaction-basic';
import {toolPairingBalancedBefore,toolPairingBalancedAfter} from '@deepseek-ai/dsh-compaction';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {loadClaudeHooksFor,runClaudeHooks,claudeHookPayload} from './claude-hooks.mjs';
import {compactionModeFor} from './compaction-mode.mjs';
import {ensureSemanticState,installSemanticStateTracking,latestSacBoundary,markSacBoundary,sacRangeFor,latestSemanticState} from './semantic-state.mjs';
// Use the SDK's supported summarize override; never mutate a routed request or session log.
const DEEPSEEK_DEFAULT_SUMMARIZER={provider:'openai-codex',model:'gpt-6.1-sol'},SUMMARIZER_PROBE_TIMEOUT_MS=2000;
const routeKey=route=>route?.provider&&route?.model?`${route.provider}/${route.model}`:'';
const sameRoute=(left,right)=>routeKey(left)!==''&&routeKey(left)===routeKey(right);
function policyFor(config,route){return config.modelPolicies?.find(policy=>sameRoute(policy,route));}
function configuredSummarizer(config,route){const policy=policyFor(config,route);return policy?.summarizationProvider&&policy?.summarizationModel?{provider:policy.summarizationProvider,model:policy.summarizationModel}:config.summarizationProvider&&config.summarizationModel?{provider:config.summarizationProvider,model:config.summarizationModel}:null}
function summarizerCandidates(config,selected,target){const fallback=target||selected,configured=configuredSummarizer(config,target);const preferred=configured||selected?.provider==='local-deepseek'?configured||DEEPSEEK_DEFAULT_SUMMARIZER:selected;return [preferred,fallback].filter((route,index,list)=>route?.provider&&route?.model&&list.findIndex(candidate=>sameRoute(candidate,route))===index)}
async function probeSummarizer(ctx,route,signal){
 if(!ctx.llm?.resolveModelInfo)return true;
 const controller=new AbortController(),abort=()=>controller.abort(signal.reason);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>controller.abort(Error(`summarizer probe timed out for ${routeKey(route)}`)),SUMMARIZER_PROBE_TIMEOUT_MS);timer.unref?.();
 try{return Boolean(await ctx.llm.resolveModelInfo(route.provider,route.model,controller.signal))}
 catch(error){if(signal.aborted)throw error;return false}
 finally{clearTimeout(timer);signal.removeEventListener('abort',abort)}
}
function scopedConfigFor(config,target,summary){
 const existing=policyFor(config,target),{summarizationProvider:_,summarizationModel:__,...targetPolicy}=existing||{},policies=(config.modelPolicies||[]).filter(policy=>!sameRoute(policy,target));
 const base={...config,modelPolicies:policies,summarizationProvider:'',summarizationModel:''};
 if(!summary||sameRoute(summary,target))return target?{...base,modelPolicies:Object.keys(targetPolicy).length?[...policies,targetPolicy]:policies}:base;
 return {...base,modelPolicies:[...policies,{...policyFor(config,target),provider:target.provider,model:target.model,summarizationProvider:summary.provider,summarizationModel:summary.model}]};
}
async function availableSummarizer(ctx,config,candidates,signal){
 for(const route of candidates)if(await probeSummarizer(ctx,route,signal))return route;
 return candidates.at(-1);
}
export async function prepareCompactionInput(ctx,input,agent,signal,trigger='auto'){
 const result=await runClaudeHooks(await loadClaudeHooksFor(ctx,agent),'PreCompact',{...claudeHookPayload(ctx,agent),trigger},{signal});
 for(const warning of result.warnings)ctx.logger?.warn('Scrum PreCompact hook: '+warning);
 const messages=compactLedgerSnapshots(input.messages);
 const additions=[];
 if(result.contexts.length)additions.push(createUserMessage({content:[{type:'text',text:'Configured pre-compaction context:\n'+result.contexts.join('\n')}],source:{kind:'agent-message',form:'relay',senderSessionId:agent.session.id}}));
 if(trigger==='sac'){
  const state=latestSemanticState(agent.session);
  additions.push(createUserMessage({content:[{type:'text',text:'SAC semantic state (observed facts only; unknown fields are not facts):\n'+JSON.stringify(state)}],source:{kind:'agent-message',form:'relay',senderSessionId:agent.session.id}}));
 }
 if(!additions.length)return messages.every((message,index)=>message===input.messages[index])?input:{...input,messages};
 return {...input,messages:[...messages,...additions]};
}
export function modelPressurePolicy(route,window,reserved,existing={},modelMax=reserved){
 if(!Number.isSafeInteger(window)||!Number.isSafeInteger(reserved)||window<=reserved+1)throw Error('モデルのコンテキスト上限と出力枠を確認してください');
 const remaining=window-reserved,headroomTokens=Math.min(existing.headroomTokens??Math.max(1,Math.floor(window*.1)),remaining-1),maxTokens=Math.min(existing.maxTokens??8192,Math.max(1,Math.floor(window*.125)),Math.max(1,modelMax),remaining-headroomTokens);
 return {...existing,provider:route.provider,model:route.model,headroomTokens,maxTokens};
}
export default class ScrumCompactionEngine extends BasicCompactionEngine {
 static inject=BasicCompactionEngine.inject;
 static Config=BasicCompactionEngine.Config;
 scrumPreCompact=true;
 async compactPressure(agent,header,signal,required){
  const route=header.config,info=await this.ctx.llm.resolveModelInfo(route.provider,route.model,signal),window=info.context?.contextWindow,reserved=route.maxTokens??info.defaultMaxTokens;
  if(Number.isSafeInteger(window)&&Number.isSafeInteger(reserved)){const existing=this.config.modelPolicies.find(p=>p.provider===route.provider&&p.model===route.model)||{},policy=modelPressurePolicy(route,window,reserved,{...this.explicitPressure,...existing},info.defaultMaxTokens??reserved);this.config={...this.config,modelPolicies:[...this.config.modelPolicies.filter(p=>p.provider!==route.provider||p.model!==route.model),policy]};}
  return super.compactPressure(agent,header,signal,required);
 }
 triggers=new WeakMap();
 pressureInFlight=new WeakSet();
 lastPressure=new WeakMap();
 cacheDeferred=new WeakSet();
 sacInFlight=new WeakSet();
 constructor(ctx,config={}){
  const policies=config.modelPolicies??[];
  const glm={provider:'local-glm',model:'glm53-fast'};
  const modelPolicies=config.maxTokens!==undefined||!Array.isArray(policies)?policies:(policies.some(p=>p.provider===glm.provider&&p.model===glm.model)?policies.map(p=>p.provider===glm.provider&&p.model===glm.model&&p.maxTokens===undefined&&p.headroomTokens===undefined?{maxTokens:8192,...p}:p):[...policies,{...glm,maxTokens:8192}]);
  super(ctx,{thresholdRatio:0.65,...config,modelPolicies});
  this.explicitPressure={...(config.headroomTokens!==undefined?{headroomTokens:config.headroomTokens}:{}),...(config.maxTokens!==undefined?{maxTokens:config.maxTokens}:{})};
  this.semanticTracker=installSemanticStateTracking(ctx);
  this.sacNonMain=config.sacNonMain!==false&&process.env.DSH_SCRUM_SAC_NON_MAIN!=='0';
  this.sacMinTokens=Number.isSafeInteger(config.sacMinTokens)?Math.max(1,config.sacMinTokens):2048;
 }
 // Only optional source pressure compaction is switchable. Provider-confirmed
 // overflow and explicit compactNow retain the SDK's mandatory recovery path.

 async compactNow(agent,signal,sourceCommandId){this.triggers.set(agent,'manual');try{const result=await super.compactNow(agent,signal,sourceCommandId);if(result)this.cacheDeferred.delete(agent);return result}finally{this.triggers.delete(agent)}}
 async compactIfNeeded(agent,trigger,signal){
  const pressure=trigger==='pressure';
  if(pressure&&compactionModeFor(agent,this.sacNonMain?'sac':'eocc')==='sac')return this.compactSac(agent,signal);
  if(pressure&&(!sourceHookEnabled(agent,'preemptive-compaction')||this.pressureInFlight.has(agent)))return null;
  if(pressure){
   this.pressureInFlight.add(agent);
   try{const cooldown=Date.now()-(this.lastPressure.get(agent)??-Infinity)<60000;if(cooldown&&await this.safeDuringCooldown(agent,signal))return null;if(!cooldown&&await this.deferWarmPressure(agent,signal)){this.cacheDeferred.add(agent);this.ctx.logger?.info('Deferred one pressure compaction while the measured prefix cache is warm');return null}}
   catch(error){if(signal.aborted)throw error}
   finally{this.pressureInFlight.delete(agent)}
   this.pressureInFlight.add(agent);
  }
  this.triggers.set(agent,trigger);
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  const timer=pressure?setTimeout(()=>controller.abort(Error('Source preemptive compaction timed out after 300000ms')),300000):null;timer?.unref();
  try{const result=await this.compactWithBoundedInput(agent,trigger,controller.signal,()=>timer?.refresh());if(result){this.cacheDeferred.delete(agent);if(pressure)this.lastPressure.set(agent,Date.now())}return result}finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);this.triggers.delete(agent);if(pressure)this.pressureInFlight.delete(agent)}
 }

 async compactSac(agent,signal){
  this.sacInFlight??=new WeakSet();this.semanticTracker??={flush:async()=>{}};this.sacMinTokens??=2048;
  if(!sourceHookEnabled(agent,'preemptive-compaction')||this.sacInFlight.has(agent))return null;
  const session=agent.session;
  await ensureSemanticState(this.semanticTracker,session);
  const events=session.snapshotEvents(),stepEnd=events.findLast(event=>event.type==='step/end');
  if(!stepEnd)return null;
  const boundary=latestSacBoundary(session);
  if(boundary?.stepEndSeq===stepEnd.seq)return null;
  const range=sacRangeFor(session,stepEnd.seq,boundary?.checkpointSeq);
  if(!range||!toolPairingBalancedBefore(session,range.start)||!toolPairingBalancedAfter(session,range.end))return null;
  const priced=this.ctx.tokenMeter.measure(session).nodes;
  const selected=priced.slice(range.startIdx,range.endIdx+1);
  const tokenCount=selected.reduce((sum,node)=>sum+(node?.tokens||0),0);
  // Very small actions remain verbatim. They are still represented in the
  // semantic-state record and will be folded once enough context accumulates.
  if(tokenCount<this.sacMinTokens)return null;
  this.sacInFlight.add(agent);this.triggers.set(agent,'sac');
  try{
   const result=await this.compactRegion(range.start,range.end,agent,signal);
   if(result){
    const current=session.snapshotEvents();
    const checkpoint=current.find(event=>event.type==='user/message'&&event.seq>result.summarySeq&&event.seq<result.endSeq&&event.data?.message?.source?.kind==='compact-checkpoint');
    await markSacBoundary(session,{stepEndSeq:stepEnd.seq,checkpointSeq:checkpoint?.seq??result.summarySeq});
   }
   return result;
  }finally{this.triggers.delete(agent);this.sacInFlight.delete(agent)}
 }

 async safeDuringCooldown(agent,signal){
  try{
   const route=agent.session.requestHeader?.()?.config||agent.options,info=await this.ctx.llm.resolveModelInfo(route.provider,route.model,signal),window=info.context?.contextWindow,maxTokens=route.maxTokens??info.defaultMaxTokens,policy=this.config.modelPolicies?.find(p=>p.provider===route.provider&&p.model===route.model),headroom=policy?.headroomTokens??this.config.headroomTokens,tokens=this.ctx.tokenMeter.measure(agent.session).totalTokens;
   return Number.isSafeInteger(window)&&window>0&&Number.isSafeInteger(maxTokens)&&maxTokens>0&&Number.isSafeInteger(headroom)&&headroom>=0&&Number.isSafeInteger(tokens)&&tokens>=0&&tokens<window-maxTokens-headroom;
  }catch(error){if(signal.aborted)throw error;return false}
 }

 async compactWithBoundedInput(agent,trigger,signal,onProgress=()=>{}){
  const session=agent.session,route=session.requestHeader()?.config;
  const boundedRoute=(route?.provider==='local-glm'&&route.model==='glm53-fast')||(route?.provider==='local-deepseek'&&route.model==='deepseek-mia-jp');
  if(!boundedRoute||!session.surface?.nodes)return super.compactIfNeeded(agent,trigger,signal);
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
  try{
   const trigger=this.triggers.get(agent);
   const prepared=await prepareCompactionInput(this.ctx,input,agent,signal,trigger==='manual'?'manual':trigger==='sac'?'sac':'auto');
   if(['pressure','source-recovery'].includes(this.triggers.get(agent))&&!sourceHookEnabled(agent,'preemptive-compaction'))throw Error('Source preemptive compaction disabled during hook I/O');
   const selected=agent.model?.current?.(),target=agent.session?.requestHeader?.()?.config,config=this.config||{},candidates=summarizerCandidates(config,selected,target),fallback=candidates.at(-1);
   if(!candidates.length)return await BasicCompactionEngine.prototype.summarize.call(Object.assign(Object.create(this),{config}),prepared,agent,signal);
   const preferred=await availableSummarizer(this.ctx,config,candidates,signal),scoped=Object.create(this);scoped.config=scopedConfigFor(config,target||fallback,preferred);
   try{return await BasicCompactionEngine.prototype.summarize.call(scoped,prepared,agent,signal)}catch(error){
    if(signal.aborted||!fallback||sameRoute(preferred,fallback))throw error;
    this.ctx.logger?.warn(`Scrum compaction summarizer ${routeKey(preferred)} failed; retrying on ${routeKey(fallback)}`);
    const retry=Object.create(this);retry.config=scopedConfigFor(config,target||fallback,fallback);
    try{return await BasicCompactionEngine.prototype.summarize.call(retry,prepared,agent,signal)}catch(retryError){retryError.cause??=error;throw retryError}
   }
  }
  catch(error){failure=error;throw error}
  finally{try{await endCompaction(agent,epoch)}catch(error){if(!failure)throw error;this.ctx.logger?.warn('Scrum compaction cleanup failed: '+error.message)}}
 }
}
