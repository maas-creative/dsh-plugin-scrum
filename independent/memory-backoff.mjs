import {redactSecretLikeMaterial} from './secret-filter.mjs';
const same=(entry,target)=>entry.conversationId===target.conversationId&&entry.end_message_id===target.endMessageId;
export function clearOnSuccess(entries,targets){return entries.filter(entry=>!targets.some(target=>same(entry,target)));}
export function applyFailure({entries=[],targets=[],failureId,reason,detail,now=new Date()}){
 const next=structuredClone(entries),at=now.toISOString();
 for(const target of targets){const index=next.findIndex(entry=>same(entry,target)),previous=index<0?null:next[index];if(previous?.lastFailureId===failureId)continue;
 const streak=(previous?.streak||0)+1,parked=streak>=5,minutes=[1,5,30,120][Math.min(streak-1,3)];
 const entry={conversationId:target.conversationId,end_message_id:target.endMessageId,state:parked?'parked':'backoff',streak,firstFailureAt:previous?.firstFailureAt||at,lastFailureAt:at,lastReason:reason,lastFailureId:failureId,nextEligibleAt:parked?null:new Date(now.getTime()+minutes*60000).toISOString(),lastDetail:redactSecretLikeMaterial(detail||'').slice(0,2000),...(parked?{parkedAt:previous?.parkedAt||at}:{})};
 if(index<0)next.push(entry);else next[index]=entry;
 }return next;
}
