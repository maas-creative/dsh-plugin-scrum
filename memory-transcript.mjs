// Rebuild the unqueued tail too: a facts debounce checkpoint is not a transcript.
export async function hydrateMemoryTranscript({ctx,session,event,queue,flatten}) {
 let stored=[],legacy=false;
 try { stored=queue.transcript(session.id); }
 catch(error) { if(!error.message.startsWith('Legacy transcript requires original session history'))throw error;legacy=true; }
 let events=session.snapshotEvents?.()||[];
 if(ctx.sessionPersistence?.open){const handle=await ctx.sessionPersistence.open(session.id,'read');try{const persisted=(await handle.read()).events||[];const merged=new Map(persisted.map(item=>[item.seq,item]));for(const item of events)merged.set(item.seq,item);events=[...merged.values()].sort((a,b)=>a.seq-b.seq)}finally{await handle.close()}}
 const original=[];
 for(const item of events){
  if(Number.isFinite(event.seq)&&item.seq>=event.seq)continue;
  if(item.type==='user/message'&&item.data?.source?.kind==='user')original.push({id:item.data.id||String(item.seq),role:'user',text:flatten(item.data)});
  if(item.type==='assistant/message'&&!item.data.interrupted&&original.length)original.push({id:item.data.message.id||String(item.seq),role:'assistant',text:flatten(item.data.message)});
 }
 if(legacy){queue.restoreTranscript({conversationId:session.id,entries:original});return original}
 if(!original.length)return stored;
 if(original.length<stored.length||stored.some((entry,i)=>JSON.stringify(entry)!==JSON.stringify(original[i])))throw Error('Native transcript differs from canonical memory checkpoint');
 return original;
}
