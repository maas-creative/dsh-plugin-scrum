const flatten=message=>typeof message?.content==='string'?message.content:(message?.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');
export function dispatchReceipt(session,marker){
 if(typeof marker!=='string'||!marker)return null;
 const events=session.snapshotEvents?.()||[],start=events.findIndex(e=>e.type==='user/message'&&flatten(e.data).startsWith(marker));
 if(start<0)return null;
 for(const event of events.slice(start+1)){
  if(event.type==='user/message'&&!['runtime-context','skill-catalog','subagent-settled','time-context','compact-checkpoint'].includes(event.data.source?.kind))return null;
  if(event.type==='turn/end')return {status:event.data.reason?.kind==='completed'?'completed':'failed',error:event.data.reason?.kind==='completed'?null:event.data.reason?.error?.message||event.data.reason?.kind||'Turn failed'};
 }
 return null;
}
