import {defineTool} from '@deepseek-ai/dsh-tools';
import {writeFile} from 'node:fs/promises';
import {setSandboxMode} from '@deepseek-ai/dsh-sandbox-policy';
export const name='scrum-docker-worker-policy';
export const inject=['tools','systemPrompt'];
export function configureWorkerPolicy(ctx,config,agent){
 const scoped=agent.ctx;
 // Docker's read-only source mount enforces source protection; native workspace-write permits isolated /tmp test fixtures.
 setSandboxMode(agent.session,'workspace-write');
 scoped.tools.register(defineTool({name:'scrum_report',description:'Save this task deliverable to its fixed output file.',parameters:{content:{type:'string',required:true}},output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},execute:async({content})=>{
  if(!content.trim()||Buffer.byteLength(content)>200000)throw Error('Report must contain 1–200000 bytes');
  await writeFile('/output/report.md',content,{mode:0o600});return '/output/report.md';
 }}));
 const forbidden=new Set(['subagent','subagent_fork','create_goal','update_goal','workpool','session_list','session_read','session_search','memory_read','memory_search']);
 const names=ctx.tools.schemas().map(tool=>tool.name);
 scoped.tools.restrict({allow:[...new Set(config.allow)].filter(name=>names.includes(name)&&!forbidden.has(name))});
 scoped.systemPrompt.section({name:'scrum:assigned-role',order:90,interpolate:false,text:config.instruction});
 return {sessionId:agent.session.id,readOnly:config.readOnly===true,tools:ctx.tools.schemas(agent).map(tool=>tool.name)};
}
export function apply(ctx,config){ctx.on('agent/created',async({agent})=>{await writeFile('/output/worker-policy.json',JSON.stringify(configureWorkerPolicy(ctx,config,agent)),{mode:0o600})})}
