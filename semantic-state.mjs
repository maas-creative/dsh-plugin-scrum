const pending=new WeakMap();
const lastStep=new WeakMap();
const scrumType=(type,suffix)=>type==='scrum/'+suffix||type==='plugin:dsh-plugin-scrum/scrum/'+suffix;
const textOf=message=>{
 const content=message?.content;
 if(typeof content==='string')return content;
 if(!Array.isArray(content))return '';
 return content.filter(block=>block?.type==='text'&&typeof block.text==='string').map(block=>block.text).join('\n');
};
const clip=(value,max=4000)=>typeof value==='string'&&value.length>max?value.slice(0,max)+'…':value||'';

function pluginState(event){
 if(!scrumType(event?.type,'semantic-state'))return undefined;
 return event?.data&&typeof event.data==='object'?event.data:undefined;
}

export function semanticStateFromEvents(events){
 const previous=events.map(pluginState).filter(Boolean).at(-1)||{};
 const users=events.filter(event=>event.type==='user/message').map(event=>({event,text:clip(textOf(event.data?.message||event.data))})).filter(item=>item.text);
 const assistants=events.filter(event=>event.type==='assistant/message').map(event=>({event,text:clip(textOf(event.data?.message||event.data))})).filter(item=>item.text);
 const calls=events.filter(event=>event.type==='tool/call').map(event=>({name:event.data?.name,callId:event.data?.callId,seq:event.seq}));
 const results=events.filter(event=>event.type==='tool/result').map(event=>({name:event.data?.message?.name||event.data?.name,seq:event.seq,error:event.data?.error?.reason||null}));
 const steps=events.filter(event=>event.type==='step/end');
 const lastAssistant=assistants.at(-1);
 const lastCall=calls.at(-1);
 const lastResult=results.at(-1);
 const latestUser=users.at(-1);
 return {
  schema:1,
  objective:previous.objective||users[0]?.text||'',
  userConstraints:latestUser&&latestUser.text!==users[0]?.text?latestUser.text:(previous.userConstraints||''),
  facts:Array.isArray(previous.facts)?previous.facts:[],
  currentWork:lastAssistant?.text||previous.currentWork||'',
  nextAction:steps.length?`Continue after completed step ${steps.at(-1)?.data?.step??steps.length}; inspect the latest outcome before acting.`:(previous.nextAction||'Start the first action.'),
  plan:Array.isArray(previous.plan)?previous.plan:[],
  completionCriteria:Array.isArray(previous.completionCriteria)?previous.completionCriteria:[],
  artifacts:Array.isArray(previous.artifacts)?previous.artifacts:[],
  verification:previous.verification&&typeof previous.verification==='object'?previous.verification:{status:'unknown'},
  deadEnds:Array.isArray(previous.deadEnds)?previous.deadEnds:[],
  lastAction:lastCall?{kind:'tool',name:lastCall.name||'unknown',callId:lastCall.callId||null,seq:lastCall.seq}:previous.lastAction||null,
  lastOutcome:lastAssistant&&(!lastResult||Number(lastAssistant.event.seq)>Number(lastResult.seq))?{kind:'assistant',seq:lastAssistant.event.seq,text:lastAssistant.text}:lastResult?{kind:'tool-result',name:lastResult.name||'unknown',seq:lastResult.seq,error:lastResult.error}:previous.lastOutcome||null,
  completedSteps:steps.length,
  sourceSeq:events.at(-1)?.seq??null,
  updatedAt:new Date().toISOString(),
 };
}

export function latestSemanticState(session){
 const state=session?.snapshotEvents?.().map(pluginState).filter(Boolean).at(-1);
 return state||semanticStateFromEvents(session?.snapshotEvents?.()||[]);
}

async function appendState(session,stepEvent){
 const events=session.snapshotEvents();
 const state=semanticStateFromEvents(events);
 state.sourceStepSeq=stepEvent.seq;
 const {appendScrumEvent}=await import('./scrum-events.mjs');
 appendScrumEvent(session,'scrum/semantic-state',state);
 lastStep.set(session,stepEvent.seq);
}

export function installSemanticStateTracking(ctx){
 const onEvent=ctx.on?.('session/event',(session,event)=>{
  if(event.type!=='step/end')return;
  if(lastStep.get(session)===event.seq)return;
  const previous=pending.get(session)||Promise.resolve();
  const job=previous.catch(()=>{}).then(async()=>{
   if(lastStep.get(session)!==event.seq)await appendState(session,event);
  });
  pending.set(session,job);
  job.catch(error=>ctx.logger?.warn?.(`Scrum semantic state update failed: ${error.message}`));
 });
 return {flush:async session=>{await pending.get(session);},dispose:()=>onEvent?.()};
}

export async function ensureSemanticState(tracker,session){
 await tracker?.flush?.(session);
 const events=session.snapshotEvents();
 const lastEnd=events.findLast(event=>event.type==='step/end');
 const state=events.map(pluginState).filter(Boolean).at(-1);
 if(lastEnd&&state?.sourceStepSeq!==lastEnd.seq)await appendState(session,lastEnd);
 return latestSemanticState(session);
}

export function sacRangeFor(session,stepEndSeq,boundarySeq){
 const nodes=session?.surface?.nodes||[];
 if(!nodes.length)return null;
 const firstIdx=session.eventAt(nodes[0])?.type==='system/message'?1:0;
 let startIdx=firstIdx;
 if(boundarySeq!==undefined){const index=nodes.indexOf(boundarySeq);if(index>=0)startIdx=index+1;}
 let endIdx=-1;
 for(let index=startIdx;index<nodes.length;index++)if(Number(nodes[index])<=Number(stepEndSeq))endIdx=index;
 if(endIdx<startIdx)return null;
 return {start:nodes[startIdx],end:nodes[endIdx],startIdx,endIdx};
}

export function latestSacBoundary(session){
 return session?.snapshotEvents?.().map(event=>scrumType(event.type,'sac-boundary')?event.data:null).filter(Boolean).at(-1);
}

export async function markSacBoundary(session,{stepEndSeq,checkpointSeq}){
 const {appendScrumEvent}=await import('./scrum-events.mjs');
 appendScrumEvent(session,'scrum/sac-boundary',{schema:1,stepEndSeq,checkpointSeq,updatedAt:new Date().toISOString()});
}
