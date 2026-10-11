export const REFLECTION_PENDING_MAX_CONVERSATIONS=32;
export function requestPriority(request){if(request.trigger==='manual'||request.trigger==='dream'&&request.origin==='manual')return 3;if(request.trigger==='dream'&&request.origin==='shutdown')return 2.5;if(request.trigger==='compaction')return 2;if(request.trigger==='dream')return 1.5;return 1;}
function mergedRequest(first,next){
 const stronger=requestPriority(next)>requestPriority(first)?next:first;
 const conversationIds=[...new Set([...(first.conversationIds||[]),...(next.conversationIds||[])])].slice(0,REFLECTION_PENDING_MAX_CONVERSATIONS);
 const snapshots=new Map();for(const entry of [...(first.snapshots||[]),...(next.snapshots||[])])if(conversationIds.includes(entry.conversationId))snapshots.set(entry.conversationId,structuredClone(entry));
 return {...structuredClone(stronger),conversationIds,snapshots:[...snapshots.values()]};
}
export function reserveTransition(previous,request,runId){
 const state=structuredClone(previous);if(!state.active){state.active={runId,request:structuredClone(request)};return {state,result:'active'};}
 if(!state.pending)state.pending={runId,request:structuredClone(request)};
 else state.pending.request=mergedRequest(state.pending.request,request);
 return {state,result:'pending'};
}
export function completeTransition(previous,runId,outcome,journals=new Map(),config={}){
 const state=structuredClone(previous),result={state,finalize:[],clearPendingCompaction:[]};
 if(state.active?.runId!==runId)return result;
 delete state.active;const pending=state.pending;delete state.pending;
 if(!pending)return result;
 // Explicit requests and maintenance retain their queued intent. Automatic
 // transcript work requires still-present evidence before another launch.
 const automatic=['step-count','compaction'].includes(pending.request.trigger);
 if(automatic){pending.request.conversationIds=(pending.request.conversationIds||[]).filter(id=>journals.has(id));pending.request.snapshots=(pending.request.snapshots||[]).filter(row=>pending.request.conversationIds.includes(row.conversationId));if(!pending.request.conversationIds.length)return result;}
 state.active=pending;result.launch=pending;return result;
}
