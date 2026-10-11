export function todoMutationOperation(previous,selected){
 if(selected.preserved)return 'update';
 if(!previous.initialized)return 'init';
 const before=new Set(previous.todos.map(t=>t.id));
 return selected.todos.some(t=>!before.has(t.id))?'append':'update';
}
export function fanoutReminderState(events){
 let shown=false;
 for(const event of events){
  if(event.type==='scrum/todo-fanout'&&event.data?.action==='shown')shown=true;
  if(event.type==='scrum/todo-fanout'&&event.data?.action==='reset')shown=false;
  if(event.type==='compaction/end'&&!event.data?.error&&event.data?.accepted!==false)shown=false;
 }
 return {shown};
}
export function fanoutReminderText({delegationForbidden=false}={}){
 const steps=['HardTackle mode is active and this session just initialized or appended its todo list. Before working any todo:','1. SIZE the work: weigh todo count, each task scope and total effort.',delegationForbidden?'2. Human or native role policy forbids delegation. Work directly; identify dependency order and do not create subagents.':'2. COMPUTE the fan-out decision: use explicitly authorized parallel subagents only when independent parts with disjoint write scopes outweigh spawn and coordination overhead; interdependent or trivial parts do not fan out.','3. TELL the user the decision and its concrete reason, including why direct execution fits when delegation is prohibited or not worthwhile.','4. KEEP the todo list fresh: mark start/done as each task transitions, append discovered steps and drop abandoned steps.'];
 return '<system-reminder>\n'+steps.join('\n')+'\nThis reminder grants no delegation or work authority. Respect human stop and existing native permissions.\n</system-reminder>';
}

import {sourceHookEnabled} from './source-hook-policy.mjs';
import {ultraworkSessionState} from './ultrawork.mjs';
import {delegationForbidden} from './usage-reminders.mjs';
export function registerTodoFanout(ctx,{readConfiguration}={}){
 const shown=new WeakMap();
 // Native disposal flush precedes disposed listeners: reset at the next owned incarnation.
 const begin=agent=>{shown.set(agent,false);agent.session.append('scrum/todo-fanout',{action:'reset',reason:'native-incarnation'})};
 ctx.on('agent/created',({agent})=>begin(agent));for(const agent of ctx.agents.list())begin(agent);
 ctx.on('tools/post-execute',async(exec,value,next)=>{
  const prior=await next(),agent=exec.agent;
  if(prior.kind!=='accept'||value.isError||!agent?.session||!['todo_write','todowrite'].includes(exec.name)||!sourceHookEnabled(agent,'todo-fanout-reminder',readConfiguration)||!ultraworkSessionState(agent.session).armed)return prior;
  let result;try{result=JSON.parse(value.content.filter(x=>x.type==='text').map(x=>x.text).join(''))}catch{return prior}
  if(!['init','append'].includes(result.operation))return prior;
  if(shown.get(agent)??fanoutReminderState(agent.session.snapshotEvents()).shown)return prior;
  shown.set(agent,true);agent.session.append('scrum/todo-fanout',{action:'shown'});
  const text=fanoutReminderText({delegationForbidden:delegationForbidden(agent)});
  return {...prior,content:[...(prior.content||value.content||[]),{type:'text',text}]};
 });
 ctx.on('session/event',(session,event)=>{if(event.type!=='compaction/end'||event.data?.error||event.data?.accepted===false)return;for(const agent of ctx.agents.list())if(agent.session===session)shown.set(agent,false);session.append('scrum/todo-fanout',{action:'reset'})});
 ctx.on('agent/disposed',({agent})=>{shown.delete(agent);agent.session.append('scrum/todo-fanout',{action:'reset'})});
}
