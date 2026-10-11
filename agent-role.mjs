import {rolePolicy} from './roles.mjs';
const roles=new WeakMap(),policies=new WeakMap();
export function bindAgentRole(agent,role,policy){roles.set(agent,role);if(policy)policies.set(agent,policy)}
export function agentRole(agent){return agent&&roles.get(agent)|| (process.env.DSH_PLANNER==='1'?'planner':process.env.DSH_ROLE||'executor')}
export function agentPolicy(agent){return agent&&policies.get(agent)||rolePolicy(agentRole(agent),agent?.session?.header?.cwd)}
