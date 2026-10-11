import {request} from './ipc.mjs';
import {agentRole,agentPolicy} from './agent-role.mjs';
const states=new WeakMap();
const events=agent=>agent?.session?.snapshotEvents?.()||[];
export const compactionCheckpoint=agent=>events(agent).filter(event=>event.type==='scrum/compaction-checkpoint').at(-1)?.data;
export const compactionState=agent=>agent&&(states.get(agent)||events(agent).filter(event=>event.type==='scrum/compaction-state').at(-1)?.data);
const append=(agent,type,data)=>agent?.session?.append?.(type,data);
export async function beginCompaction(agent,{ctx}={}){
 const previous=compactionState(agent)||{},state={epoch:(previous.epoch||0)+1,startedAt:Date.now(),active:true};states.set(agent,state);
 try{
 const selected=agent.session?.requestHeader?.()?.config||agent.options||{},policy=agentPolicy(agent);let toolNames;
 const tools=ctx?.get?.('tools')||agent.ctx?.get?.('tools');if(tools?.schemas)toolNames=tools.schemas(agent).map(tool=>tool.name).sort();
 append(agent,'scrum/compaction-checkpoint',{epoch:state.epoch,capturedAt:state.startedAt,role:agentRole(agent),policy:JSON.parse(JSON.stringify(policy)),cwd:agent.session?.header?.cwd||'',route:{provider:selected.provider||'openai-codex',model:selected.model||'gpt-6.1-sol',reasoningEffort:selected.reasoningEffort||'low'},...(toolNames?{toolNames}:{})});
 append(agent,'scrum/compaction-state',state);if(ctx?.sessions?.flush)await ctx.sessions.flush(agent.session);
 if(process.env.DSH_SCRUM_SOCKET&&process.env.DSH_SCRUM_TOKEN&&process.env.DSH_PLANNER==='1'){const saved=await request(process.env.DSH_SCRUM_SOCKET,process.env.DSH_SCRUM_TOKEN,'compaction_guard',{action:'begin',epoch:state.epoch},agent.session.id);state.epoch=saved.epoch;states.set(agent,state);append(agent,'scrum/compaction-state',state);const checkpoint=compactionCheckpoint(agent);if(checkpoint&&checkpoint.epoch!==state.epoch)append(agent,'scrum/compaction-checkpoint',{...checkpoint,epoch:state.epoch});if(ctx?.sessions?.flush)await ctx.sessions.flush(agent.session)}
 return state.epoch;
 }catch(error){const ended={...state,active:false,acknowledgedEpoch:state.epoch,error:error.message};states.set(agent,ended);append(agent,'scrum/compaction-state',ended);throw error}
}
export async function endCompaction(agent,epoch){
 const state=compactionState(agent);if(!state||state.epoch!==epoch)return false;const ended={...state,active:false,acknowledgedEpoch:epoch};states.set(agent,ended);append(agent,'scrum/compaction-state',ended);
 if(process.env.DSH_SCRUM_SOCKET&&process.env.DSH_SCRUM_TOKEN&&process.env.DSH_PLANNER==='1')await request(process.env.DSH_SCRUM_SOCKET,process.env.DSH_SCRUM_TOKEN,'compaction_guard',{action:'end',epoch},agent.session.id);
 return true;
}
