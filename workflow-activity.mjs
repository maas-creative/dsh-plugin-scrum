// Public native persistence supplies event time and header.createdAt; stat has no public mtime.
export function createWorkflowActivityReader(ctx,{ownerOf,historicalOwner}={}){return async(id,parent)=>{
 if(id!==parent&&ownerOf?.(id)?.parentSession!==parent&&!historicalOwner?.(id,parent))throw Error('Workflow activity outside parent ownership');
 const values=[],add=value=>{if(typeof value==='number'&&Number.isFinite(value)&&value>=0)values.push(value);};
 const live=ctx.agents.get(id)?.session;add(live?.header?.createdAt);for(const event of live?.snapshotEvents?.()||[])add(event.time);
 const stat=await ctx.sessionPersistence.stat(id);add(stat?.header?.createdAt);
 if(stat){const handle=await ctx.sessionPersistence.open(id,'read');try{const saved=await handle.read();for(const event of saved.events||[])add(event.time);}finally{await handle.close();}}
 return values.length?Math.max(...values):null;
};}
export function workflowHistoricalOwner(store,id,parent){return store.all("SELECT value FROM settings WHERE key LIKE 'scrumWorkflow:%'").some(row=>{const w=JSON.parse(row.value);if(w.parentSession!==parent||!w.sessions?.includes(id))return false;let owner=id;for(const event of w.events||[])if(event.type==='handoff'&&event.from===owner)owner=event.to;return owner===parent&&owner!==id;});}
