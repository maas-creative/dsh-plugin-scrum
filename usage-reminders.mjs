import {sourceHookEnabled} from './source-hook-policy.mjs';
import {createUserMessage} from '@deepseek-ai/dsh-llm';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import {join} from 'node:path';
import {agentRole,agentPolicy} from './agent-role.mjs';
// OMO @59d23b5: agent-usage-reminder MAX_REMINDERS=3; category-skill-reminder
// first reminder after 3 work tools, one per session. Neither resets on compaction.
const search=new Set(['grep','glob','web_search','fetch_content','get_search_content']),work=new Set(['edit','write','bash','read','grep','glob']),delegates=new Set(['task','call_omo_agent']);
const orchestration=new Set(['sisyphus','sisyphus-junior','executor','atlas','hephaestus','prometheus','planner']);
const categoryRoles=new Set(['sisyphus','sisyphus-junior','executor','atlas']);
const AGENT_MARKER='[Scrum agent usage reminder]',CATEGORY_MARKER='[Scrum category skill reminder]',NOTEPAD_MARKER='[Scrum Atlas notepad contract]';
export const atlasNotepadDirective=NOTEPAD_MARKER+'\nAppend verified findings under .omo/notepads/{plan-name}/learnings.md, issues.md, decisions.md and problems.md. Preserve existing notes; never overwrite with write. Use edit to append. Read the plan at .omo/plans/{plan-name}.md but do not modify plan checkboxes; Atlas checks them after verifying the actual artifacts. Keep implementation within the assigned canonical task.\n\n';
export function delegationForbidden(agent){
 const policy=agentPolicy(agent);if(policy.planningOnly||policy.readOnly||policy.noDelegation===true||policy.allow&&!policy.allow.some(tool=>delegates.has(tool))||policy.deny?.some(tool=>delegates.has(tool)))return true;
 let text='';try{text=readFileSync(join(agent.session.header.cwd,'AGENTS.md'),'utf8')}catch(error){if(error.code!=='ENOENT')throw error}
 text+='\n'+(agent.session.snapshotEvents?.()||[]).filter(e=>e.type==='user/message'&&e.data.source?.kind==='user').flatMap(e=>(e.data.content||[]).filter(b=>b.type==='text').map(b=>b.text)).join('\n');
 return /(?:do not|don't|never|no)\s+(?:use\s+)?(?:subagents?|sub-agents?|delegat\w*)|(?:サブエージェント|他のエージェント|委譲)[^。\n]{0,60}(?:禁止|使わ|使用しない|使用するな)|(?:delegate|subagent)[^\n]{0,30}forbidden/i.test(text);
}
function historyState(agent){
 const events=agent.session.snapshotEvents?.()||[],calls=new Map(),state={used:false,count:0,agentReminders:0,categoryShown:false,seen:new Set()};
 for(const event of events){if(event.type==='tool/call')calls.set(event.data.callId,event.data.name);if(event.type==='tool/result'){const id=event.data.message?.callId||event.data.callId,name=calls.get(id);if(name&&!state.seen.has(id)){state.seen.add(id);if(delegates.has(name))state.used=true;if(work.has(name))state.count++}}
 if(event.type==='user/message'){const text=(event.data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');if(text.includes(AGENT_MARKER))state.agentReminders++;if(text.includes(CATEGORY_MARKER))state.categoryShown=true}}
 return state;
}
export function registerUsageReminders(ctx,{readConfiguration}={}){
 const enabled=(agent,name)=>sourceHookEnabled(agent,name,readConfiguration);
 const states=new WeakMap(),stateFor=agent=>{if(!states.has(agent))states.set(agent,historyState(agent));return states.get(agent)},relay=(agent,text)=>createUserMessage({content:[{type:'text',text}],source:{kind:'agent-message',form:'relay',senderSessionId:agent.session.id}});
 ctx.on('tools/post-execute',async(exec,value,next)=>{
  const prior=await next();if(prior.kind!=='accept'||value.isError||!exec.agent?.session)return prior;const agent=exec.agent,role=agentRole(agent),state=stateFor(agent),id=exec.rootCallId||exec.callId;
  if(state.seen.has(id))return prior;state.seen.add(id);if(delegates.has(exec.name)){state.used=true;return prior}if(work.has(exec.name))state.count++;if(!orchestration.has(role)||state.used||delegationForbidden(agent))return prior;
  const messages=[];if(enabled(agent,'agent-usage-reminder')&&search.has(exec.name)&&state.agentReminders<3){messages.push(AGENT_MARKER+'\nFor explicitly authorized delegation, use canonical task IDs with task and explore/librarian roles; load relevant skills, collect background_output and verify actual artifacts. This reminder does not authorize creating agents.')}
  if(enabled(agent,'category-skill-reminder')&&categoryRoles.has(role)&&state.count>=3&&!state.categoryShown){const skills=await ctx.skills.list({cwd:agent.session.header.cwd,scope:agent});if(enabled(agent,'category-skill-reminder')){messages.push(CATEGORY_MARKER+'\nFor authorized delegated work, select a fitting category and load_skills from available skills: '+skills.map(s=>s.name).join(', ')+'. Preserve canonical output and completion criteria; unavailable skills cannot be assumed loaded.')}}
  const ready=messages.filter(text=>enabled(agent,text.startsWith(AGENT_MARKER)?'agent-usage-reminder':'category-skill-reminder'));if(ready.some(text=>text.startsWith(AGENT_MARKER)))state.agentReminders++;if(ready.some(text=>text.startsWith(CATEGORY_MARKER)))state.categoryShown=true;
  return ready.length?{...prior,additionalContexts:[...(prior.additionalContexts||[]),...ready.map(text=>relay(agent,text))]}:prior;
 });
 ctx.on('tools/execute',async(exec,next)=>{
  if(!enabled(exec.agent,'sisyphus-junior-notepad')||exec.name!=='task'||agentRole(exec.agent)!=='atlas'||delegationForbidden(exec.agent)||typeof exec.arguments?.prompt!=='string'||exec.arguments.prompt.includes(NOTEPAD_MARKER))return next();
  return ctx.tools.execute({name:exec.name,arguments:{...exec.arguments,prompt:atlasNotepadDirective+exec.arguments.prompt},callId:exec.callId+':notepad:'+randomUUID(),rootCallId:exec.rootCallId||exec.callId,agent:exec.agent,parent:exec.token,signal:exec.signal});
 });
}
