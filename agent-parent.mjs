// Trusted host bindings supplement immutable lineage for sessions created before lineage was stored.
const parents=new WeakMap();
export function bindAgentParent(agent,parent){if(parent&&parent!==agent.session.id)parents.set(agent,parent)}
export async function belongsToQuestionHost(ctx,agent,root){
 let id=agent?.session.id,header=agent?.session.header,parent=parents.get(agent),seen=new Set();
 while(id&&seen.size<128){if(id===root)return true;if(seen.has(id))return false;seen.add(id);id=parent||header?.parentSession;if(!id)return false;if(id===root)return true;const live=ctx.agents?.get(id);header=live?.session.header||(await ctx.sessionPersistence?.stat(id))?.header;parent=live?parents.get(live):undefined;}
 return false;
}
