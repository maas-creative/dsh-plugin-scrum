export const REFLECTION_SNAPSHOT_MAX_BYTES=131072;
export const REFLECTION_STATE_SCHEMA_VERSION='v3_assistant_steps';
export const initialReflectionState=()=>({schema_version:REFLECTION_STATE_SCHEMA_VERSION,total_completed_steps:0,reflected_completed_steps:0,steps_since_last_successful_reflection:0});
export const isCanonicalEntry=entry=>!!entry&&['user','assistant'].includes(entry.kind)&&typeof entry.source_message_id==='string'&&typeof entry.text==='string';
export const countCompletedSteps=entries=>entries.filter(entry=>entry.kind==='assistant').length;
const byteLength=entries=>entries.reduce((sum,entry)=>sum+Buffer.byteLength(JSON.stringify(entry))+1,0);
const boundary=(entries,state)=>state.reflected_through_message_id===undefined?0:entries.findLastIndex(entry=>entry.source_message_id===state.reflected_through_message_id)+1;
export const reflectedThroughByteOffset=(entries,state)=>byteLength(entries.slice(0,boundary(entries,state)));
export function deriveState(state,entries){
 const end=boundary(entries,state),total=countCompletedSteps(entries),reflected=countCompletedSteps(entries.slice(0,end));
 return {...state,schema_version:REFLECTION_STATE_SCHEMA_VERSION,total_completed_steps:total,reflected_completed_steps:reflected,steps_since_last_successful_reflection:total-reflected,unreflected_bytes:byteLength(entries.slice(end))};
}
export function captureCursorSnapshot(entries,state,{maxBytes=REFLECTION_SNAPSHOT_MAX_BYTES}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<1)throw Error('Invalid transcript snapshot budget');
 const start=boundary(entries,state);if(start>=entries.length||!entries.slice(start).some(isCanonicalEntry))return null;
 let end=start,bytes=0;
 while(end<entries.length){let next=end+1;while(next<entries.length&&entries[next].source_message_id===entries[end].source_message_id)next++;
  const size=byteLength(entries.slice(end,next));if(end>start&&bytes+size>maxBytes)break;bytes+=size;end=next;
 }
 return {start_message_id:entries[start].source_message_id,end_message_id:entries[end-1].source_message_id,start_line:start,end_snapshot_line:end,entries:structuredClone(entries.slice(start,end)),...(end<entries.length?{backlog_remaining:entries.length-end}:{})};
}
export function finalizeCursor(state,entries,snapshot,succeeded,at){
 if(!succeeded)return deriveState(state,entries);
 const end=snapshot.end_snapshot_line;
 if(!Number.isSafeInteger(end)||end<1||end>entries.length||entries[end-1].source_message_id!==snapshot.end_message_id||entries[end]?.source_message_id===snapshot.end_message_id)throw Error('Reflection receipt does not cover a complete message group');
 const previous=boundary(entries,state);if(end<previous)throw Error('Reflection receipt cannot move the cursor backward');
 return deriveState({...state,reflected_through_message_id:snapshot.end_message_id,reflected_through_byte_offset:byteLength(entries.slice(0,end)),last_reflection_succeeded_at:at,consecutive_failures:0,next_eligible_at:undefined},entries);
}
