import {sourceHookEnabled} from './source-hook-policy.mjs';
import {beginCompaction,endCompaction} from './compaction-state.mjs';
import {BasicCompactionEngine} from '@deepseek-ai/dsh-compaction-basic';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {loadClaudeHooksFor,runClaudeHooks,claudeHookPayload} from './claude-hooks.mjs';
// Use the SDK's supported summarize override; never mutate a routed request or session log.
export async function prepareCompactionInput(ctx,input,agent,signal,trigger='auto'){
 const result=await runClaudeHooks(await loadClaudeHooksFor(ctx,agent),'PreCompact',{...claudeHookPayload(ctx,agent),trigger},{signal});
 for(const warning of result.warnings)ctx.logger?.warn('Scrum PreCompact hook: '+warning);
 if(!result.contexts.length)return input;
 return {...input,messages:[...input.messages,createUserMessage({content:[{type:'text',text:'Configured pre-compaction context:\n'+result.contexts.join('\n')}],source:{kind:'agent-message',form:'relay',senderSessionId:agent.session.id}})]};
}
export default class ScrumCompactionEngine extends BasicCompactionEngine {
 static inject=BasicCompactionEngine.inject;
 static Config=BasicCompactionEngine.Config;
 scrumPreCompact=true;
 triggers=new WeakMap();
 pressureInFlight=new WeakSet();
 lastPressure=new WeakMap();
 constructor(ctx,config={}){super(ctx,{thresholdRatio:0.78,...config})}
 // Only optional source pressure compaction is switchable. Provider-confirmed
 // overflow and explicit compactNow retain the SDK's mandatory recovery path.

 async compactNow(agent,signal,sourceCommandId){this.triggers.set(agent,'manual');try{return await super.compactNow(agent,signal,sourceCommandId)}finally{this.triggers.delete(agent)}}
 async compactIfNeeded(agent,trigger,signal){
  const pressure=trigger==='pressure';
  if(pressure&&(!sourceHookEnabled(agent,'preemptive-compaction')||this.pressureInFlight.has(agent)||Date.now()-(this.lastPressure.get(agent)??-Infinity)<60000))return null;
  if(pressure)this.pressureInFlight.add(agent);
  this.triggers.set(agent,trigger);
  const controller=new AbortController(),abort=()=>controller.abort(signal.reason);if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});
  const timer=pressure?setTimeout(()=>controller.abort(Error('Source preemptive compaction timed out after 60000ms')),60000):null;timer?.unref();
  try{return await super.compactIfNeeded(agent,trigger,controller.signal)}finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);this.triggers.delete(agent);if(pressure)this.pressureInFlight.delete(agent)}
 }

 async recoverPostCompaction(agent,signal){if(!sourceHookEnabled(agent,'preemptive-compaction'))return null;this.triggers.set(agent,'source-recovery');try{return await super.compactIfNeeded(agent,'context-overflow',signal)}finally{this.triggers.delete(agent)}}
 async summarize(input,agent,signal){
  if(['pressure','source-recovery'].includes(this.triggers.get(agent))&&!sourceHookEnabled(agent,'preemptive-compaction'))throw Error('Source preemptive compaction disabled before summarization');if(this.triggers.get(agent)==='pressure')this.lastPressure.set(agent,Date.now())
  const epoch=await beginCompaction(agent,{ctx:this.ctx});let failure;
  try{const prepared=await prepareCompactionInput(this.ctx,input,agent,signal,this.triggers.get(agent)==='manual'?'manual':'auto');if(['pressure','source-recovery'].includes(this.triggers.get(agent))&&!sourceHookEnabled(agent,'preemptive-compaction'))throw Error('Source preemptive compaction disabled during hook I/O');return await super.summarize(prepared,agent,signal)}
  catch(error){failure=error;throw error}
  finally{try{await endCompaction(agent,epoch)}catch(error){if(!failure)throw error;this.ctx.logger?.warn('Scrum compaction cleanup failed: '+error.message)}}
 }
}
