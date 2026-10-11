import {realpath} from 'node:fs/promises';import {resolve,relative,dirname,isAbsolute} from 'node:path';
import {roles,roleInstruction,rolePolicy} from './roles.mjs';import {agentRole,agentPolicy} from './agent-role.mjs';
import {loadScrumConfiguration,configurationAllows} from './configuration.mjs';
export async function planPathAllowed(cwd,path){
 if(typeof path!=='string'||!path.endsWith('.md'))return false;
 const root=await realpath(cwd),target=resolve(root,path);let existing=target,tail=[];
 for(;;){try{existing=await realpath(existing);break}catch(error){if(error.code!=='ENOENT')throw error;const parent=dirname(existing);if(parent===existing)return false;tail.unshift(existing.slice(parent.length+1));existing=parent}}
 const rel=relative(root,resolve(existing,...tail));return !isAbsolute(rel)&&/^\.omo\/(plans|drafts)\/.+\.md$/.test(rel);
}
export function registerRoleContext(ctx,{coordinator=false}={}){
 ctx.on('system-prompt/assemble',async(assembly,input,next)=>{
  const prior=await next(),agent=input.agent||input.scope;if(!agent?.session)return prior;
  const cwd=agent.session.header.cwd||process.cwd(),config=loadScrumConfiguration({cwd}).config,boundRole=agentRole(agent)||'executor',role=coordinator&&!agent.session.header.parentSession&&boundRole==='executor'?'sisyphus':boundRole;
  const availableAgents=Object.entries(roles).filter(([name])=>configurationAllows(config,'agents',name)&&config.agents?.[name]?.disable!==true).map(([name,definition])=>({name,description:definition.instruction,metadata:{category:'utility',cost:'FREE',triggers:[]}}));
  const tools=ctx.tools.schemas(agent).map(t=>t.name),skills=ctx.skills?await ctx.skills.list({cwd,scope:agent}):[];
  const categories=Object.entries(config.categories||{}).map(([name,definition])=>({name,description:definition.description||name}));
  const text=roleInstruction(role,cwd,{agents:availableAgents,tools,skills:skills.filter(s=>configurationAllows(config,'skills',s.name)).map(s=>({name:s.name,description:s.description,location:s.source?.startsWith('project')?'project':'plugin'})),categories});
  return {...prior,sections:[...(prior.sections||[]).filter(section=>section.name!=='scrum:dynamic-role'),{name:'scrum:dynamic-role',text,interpolate:false}]};
 });
 ctx.on('tools/pre-execute',async(exec,next)=>{
  const prior=await next();if(!['allow','ask'].includes(prior.kind))return prior;
  const role=agentRole(exec.agent),policy=agentPolicy(exec.agent);
  if(role!=='planner'&&role!=='prometheus'&&!policy.planningOnly)return prior;
  if(exec.name==='workpool'&&exec.arguments?.op==='yield')return prior;
  const allowed=rolePolicy('planner',exec.agent?.session.header.cwd).allow;
  if(!allowed.includes(exec.name)||exec.name==='workpool')return {kind:'deny',reason:'Planning-only role cannot implement or delegate work'};
  if(['write','edit'].includes(exec.name)){
   const path=exec.arguments?.file_path||exec.arguments?.filePath||exec.arguments?.path;
   if(!await planPathAllowed(exec.agent.session.header.cwd,path))return {kind:'deny',reason:'Planning-only writes must target Markdown under .omo/plans or .omo/drafts'};
  }
  return prior;
 });
}
