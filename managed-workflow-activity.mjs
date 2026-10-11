import {stat} from 'node:fs/promises';

// Observe only session ids recorded by this parent's canonical workflow.
export async function managedWorkflowActivity(runtime,id,parent){
 if(typeof id!=='string'||!id||typeof parent!=='string'||!parent)throw Error('Workflow activity requires an owned session');
 const recorded=runtime.s.all("SELECT value FROM settings WHERE key LIKE 'scrumWorkflow:%'").map(row=>JSON.parse(row.value));
 const historical=recorded.some(w=>{if(w.parentSession!==parent||!w.sessions?.includes(id))return false;let owner=id;for(const event of w.events||[])if(event.type==='handoff'&&event.from===owner)owner=event.to;return owner===parent&&owner!==id});
 if(id!==parent&&runtime.ownerOf?.(id)?.parentSession!==parent&&!historical)throw Error('Workflow activity session is outside parent');
 const managed=runtime.io?.managedSessions?.(runtime.s)||runtime.s.setting('piSessions',{});
 const session=Object.values(managed).find(row=>row.id===id);
 if(!session?.path||session.path.startsWith('dsh:'))return null;
 try{const info=await stat(session.path);if(!info.isFile())throw Error('Workflow transcript is not a file');return info.mtimeMs;}
 catch(error){if(error.code==='ENOENT')return null;throw error;}
}
