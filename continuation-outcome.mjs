// DSH adapter for the pinned OMO ulw-execute-continuation terminal-outcome contract.
// DSH owns retries and compaction; only settled completed/length turns are admitted.
export function continuationOutcome(session,end){
 const reason=end?.data?.reason?.kind||'unknown';if(!['completed','max-tokens'].includes(reason))return reason;
 const events=session.snapshotEvents?.()||[],endIndex=events.findIndex(e=>e===end||end?.seq!==undefined&&e.seq===end.seq);if(endIndex<0)return 'missing-outcome';let start=endIndex;while(start>=0&&events[start].type!=='turn/start')start--;if(start<0)return 'missing-outcome';const turn=events.slice(start+1,endIndex);const assistant=turn.findLast(e=>e.type==='assistant/message');if(!assistant)return 'missing-outcome';const message=assistant.data.message;if(message?.content?.some(b=>b.type==='tool-call'))return 'unfinished-turn';const after=turn.slice(turn.indexOf(assistant)+1);if(after.some(e=>e.type==='tool/result'&&e.data.message?.isError&&e.data.message.content?.some(b=>b.type==='text'&&/\babort(?:ed)?\b/i.test(b.text))))return 'aborted-tool-result';return reason;
}
