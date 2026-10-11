import {loadScrumConfiguration,configurationAllows} from './configuration.mjs';
import {sourceHookEnabled} from './source-hook-policy.mjs';
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {readFileSync} from 'node:fs';
import {visibleRequest} from './independent/request-visibility.mjs';
export {visibleRequest} from './independent/request-visibility.mjs';
export function parseUltraworkRequest(text){const visible=visibleRequest(text).trim(),match=visible.match(/^\/?(?:hdt|ultrawork|ulw)(?:\s+([\s\S]*))?$/i);if(!match)return null;const goal=(match[1]||'').trim();if(/(?:\?|？|とは|って何|what is|^(?:is|means|stands for)\b)/i.test(goal))return null;return {goal};}
export function ultraworkState(messages){
 let armed=false;
 for(const m of messages){if(m.role!=='user'||m.source?.kind!=='user')continue;const text=typeof m.content==='string'?m.content:m.content.filter(c=>c.type==='text').map(c=>c.text).join('\n');const visible=visibleRequest(text);if(/\/stop-continuation\b/.test(visible))armed=false;else if(parseUltraworkRequest(text))armed=true;}
 return {armed,startsGoal:false};
}
export function ultraworkSessionState(session){const events=session?.snapshotEvents?.();return ultraworkState(events?events.filter(e=>e.type==='user/message').map(e=>({...e.data,role:'user'})):session?.deriveMessages?.()||[]);}
export function registerUltrawork(ctx,remote,{readConfiguration}={}){
 if(remote&&typeof ctx.on==='function')ctx.on('system-prompt/assemble',async(assembly,input,next)=>{const prior=await next(),agent=input.agent||input.scope;if(!agent?.session||!sourceHookEnabled(agent,'keyword-detector',readConfiguration))return prior;const events=agent.session.snapshotEvents?.();const messages=events?events.filter(e=>e.type==='user/message').map(e=>e.data):agent.session.deriveMessages?.()||[];const human=messages.filter(m=>m.source?.kind==='user').at(-1);if(!human)return prior;const text=typeof human.content==='string'?human.content:(human.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');const request=parseUltraworkRequest(text);if(request)await remote('activate',{...request,humanCount:messages.filter(m=>m.source?.kind==='user').length,activationId:JSON.stringify({count:messages.filter(m=>m.source?.kind==='user').length,text})},agent.session.id);return prior;});
 for(const name of ['hdt','ulw'])ctx.commands.register({name,description:name==='hdt'?'Enable HardTackle and execute the supplied natural language request':'Compatibility alias for /hdt (HardTackle)',handler:async({rawInput='',agent})=>{if(!agent||!remote)return {kind:'error',text:'Scrum execution runtime required'};try{if(!parseUltraworkRequest('hdt '+rawInput))return {kind:'success',text:'HardTackle: /hdt request enables continued planning, delegation, verification and cleanup. Bare /hdt enables the mode without creating a goal.'};const events=agent.session.snapshotEvents?.(),messages=events?events.filter(e=>e.type==='user/message').map(e=>e.data):agent.session.deriveMessages?.()||[];await remote('activate',{goal:rawInput.trim(),afterHumanCount:messages.filter(m=>m.source?.kind==='user').length,activationId:'command:'+Date.now()},agent.session.id);agent.inject(createUserMessage({content:[{type:'text',text:'hdt '+rawInput}],source:{kind:'user'}}));return {kind:'success',text:rawInput.trim()?'HardTackle request activated':'HardTackle mode enabled'}}catch(error){return {kind:'error',text:error.message}}}});
 const source=readFileSync(new URL('./skills/hardtackle/SKILL.md',import.meta.url),'utf8').replace(/^---\n[\s\S]*?\n---\n/,'');
 ctx.systemPrompt.section({name:'scrum:hardtackle',order:140,interpolate:false,text:({agent})=>{
  if(!agent||!sourceHookEnabled(agent,'keyword-detector',readConfiguration)||!ultraworkSessionState(agent.session).armed)return '';
  return source+'\nScrum policy: preserve configured model and low reasoning effort. A bare mode directive creates no goal or task. A leading hdt or /hdt work request activates parent-owned continuation without project registration. Use task_create with body, output and completionCriteria, task to delegate, background_output to inspect evidence, and scrum_review to verify. Never require scrum_project or Dashboard IDs. Close owned Teams and monitors before completion. Explicit work authorization and tool availability govern execution.';
 }});
 for(const [name,method,directive] of [['stop-continuation','stop-continuation','/stop-continuation'],['resume-continuation','resume','hdt']])ctx.commands.register({name,description:name==='stop-continuation'?'Stop this parent and its queued workers; preserve artifacts':'Explicitly resume this parent continuation',handler:async({agent})=>{
  if(name==='stop-continuation'&&agent){const value=readConfiguration?readConfiguration({cwd:agent.session.header?.cwd||process.cwd(),agent}):loadScrumConfiguration({cwd:agent.session.header?.cwd||process.cwd()}).config;if(!configurationAllows(value?.config||value||{},'commands',name))return {kind:'error',text:'Builtin command disabled: stop-continuation. Native host interrupt/emergency stop and /scrum pause remain available.'};}
  if(!agent||!remote)return {kind:'error',text:'Continuation control requires an agent and connected Scrum execution runtime'};
  try{const state=await remote(method,{},agent.session.id);agent.inject(createUserMessage({content:[{type:'text',text:directive}],source:{kind:'user'}}));return {kind:'success',text:JSON.stringify(state)}}catch(error){return {kind:'error',text:error.message}}
 }});
 for(const name of ['scrum-hdt-state','scrum-ulw-state'])ctx.commands.register({name,description:'Session-scoped HardTackle directive status; does not start work',handler:({agent})=>({kind:'success',text:JSON.stringify(ultraworkSessionState(agent?.session))})});
}

// Public naming aliases; persisted ULW keys and old imports remain compatible.
export const parseHardTackleRequest=parseUltraworkRequest,hardTackleState=ultraworkState,hardTackleSessionState=ultraworkSessionState,registerHardTackle=registerUltrawork;
