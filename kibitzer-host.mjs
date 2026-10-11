import {createKibitzerSidecar,createKibitzerSidecarTools,createKibitzerWakeSlot,resolveKibitzerSidecarSettings} from './independent/memory-advisor.mjs';
import {createKibitzerChildStarter} from './kibitzer-child.mjs';

// Native persisted events are translated into a plain branch snapshot. Internal memory
// receipts and agent relays cannot masquerade as genuine user requests.
function textContent(content){return typeof content==='string'?content:(Array.isArray(content)?content:[]).filter(block=>block.type==='text'&&typeof block.text==='string').map(block=>({type:'text',text:block.text}));}
export function kibitzerBranch(events){
 return events.map(event=>{
  if(event.type==='user/message')return event.data.source?.kind==='user'?{type:'message',message:{role:'user',content:textContent(event.data.content)}}:{type:'custom',customType:'scrum/relay'};
  if(event.type==='assistant/message')return event.data.interrupted?{type:'custom',customType:'scrum/interrupted'}:{type:'message',message:{role:'assistant',content:textContent(event.data.message.content)}};
  return {type:'custom',customType:event.type};
 });
}

export function createNativeKibitzer({ctx,agent,recall,settings,locksDirectory,deliver,onWake,startChild=createKibitzerChildStarter(ctx,agent)}){
 if(typeof locksDirectory!=='string'||!locksDirectory)throw Error('Shared machine-wide Kibitzer locks directory required');
 const resolved=resolveKibitzerSidecarSettings({...settings,event_caps:settings.event_caps??{}});
 let branch=[],closed=false,offeredInput;const wakeInputs=new Map();
 const sidecar=createKibitzerSidecar({sessionId:agent.session.id,startChild,
  wakeSlot:createKibitzerWakeSlot({locksDirectory,maxConcurrent:resolved.maxConcurrentWakes??2}),
  toolBudget:resolved.toolBudget,sidecarMaxTokens:resolved.sidecarMaxTokens,eventCaps:resolved.eventCaps,
  createTools:binding=>createKibitzerSidecarTools({workspaceRoot:agent.session.header.cwd,session:{entries:()=>branch},memory:{repo:{},cache:{load:async()=>recall.committedCorpus()},queryExpansion:resolved.queryExpansion},...binding}),
  deliver:async(nudges,meta)=>{const offered=wakeInputs.get(meta.wake)||offeredInput,current=recall.inputForAgent(agent);if(!offered||!current||offered.messageId!==current.messageId||offered.query!==current.query||offered.revision!==current.revision)throw Error('Recall query or committed corpus changed during wake');return deliver(nudges,meta)},onWake});
 const refresh=()=>{branch=kibitzerBranch(agent.session.snapshotEvents());return branch};
 return {
  state:sidecar.state,
  prompt(text){sidecar.events.onPrompt({prompt:text},refresh())},
  toolCall(name,args,id){sidecar.events.onToolCall({toolName:name,input:args,toolCallId:id},refresh())},
  toolResult(payload){sidecar.events.onToolResult(payload,refresh())},
  async offer(){if(closed)return {action:'buffered',reason:'disposed'};refresh();recall.forAgent(agent);const input=recall.inputForAgent(agent);if(!input)return {action:'buffered',reason:'no_new_candidate'};const surfaced=new Set(agent.session.snapshotEvents().filter(e=>e.type==='scrum/memory-surfaced').flatMap(e=>e.data.paths||[]));const snapshot=JSON.parse(JSON.stringify({messageId:input.messageId,query:input.query,revision:input.revision,toolTexts:[...(input.toolTexts||[])]}));offeredInput=snapshot;if(agent.session.append&&ctx.sessions?.flush){const latest=agent.session.snapshotEvents().filter(e=>e.type==='scrum/memory-recall-input').at(-1)?.data;if(JSON.stringify(latest)!==JSON.stringify(snapshot)){agent.session.append('scrum/memory-recall-input',snapshot);await ctx.sessions.flush(agent.session)}}const result=await sidecar.offer({candidates:input.candidates,surfaced,maxItems:settings.max_items??3,taskSummary:input.query.slice(0,4000)});if(result.wake&&!wakeInputs.has(result.wake)){if(wakeInputs.size>=32)wakeInputs.delete(wakeInputs.keys().next().value);wakeInputs.set(result.wake,snapshot)}return result},
  whenIdle:sidecar.whenIdle,
  async shutdown(){closed=true;await sidecar.shutdown();await startChild.drain?.()}
 };
}
