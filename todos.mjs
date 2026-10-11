import {registerTodoFanout,todoMutationOperation} from './todo-fanout.mjs';
import {z} from 'zod';
import {createHash} from 'node:crypto';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {TODOWRITE_DESCRIPTION,hasDetailedTodos,isAtlasBootstrapTodoList} from './independent/todo-policy.mjs';
const statuses=['pending','in_progress','completed','cancelled'],priorities=['high','medium','low'];
const row=z.object({id:z.string(),content:z.string(),status:z.enum(statuses),priority:z.enum(priorities)});
const stateSchema=z.object({initialized:z.boolean(),todos:z.array(row),protected:z.boolean()});
export const initialTodos=()=>({initialized:false,todos:[],protected:false});
const idFor=content=>'todo-'+createHash('sha256').update(content).digest('hex').slice(0,24);
export function normalizeTodos(raw,{requirePriority=false}={}){
 if(!Array.isArray(raw))throw Error('Todo list required');const contents=new Set(),ids=new Set();let active=0;
 const todos=raw.map(item=>{if(!item||typeof item.content!=='string'||!item.content.trim())throw Error('Todo content required');const content=item.content.trim(),id=item.id||idFor(content),priority=item.priority??(requirePriority?undefined:'medium');if(!statuses.includes(item.status)||!priorities.includes(priority)||typeof id!=='string')throw Error('Invalid Todo status, priority or id');if(contents.has(content)||ids.has(id))throw Error('Duplicate Todo content or id');contents.add(content);ids.add(id);if(item.status==='in_progress')active++;return {id,content,status:item.status,priority}});
 if(active>1)throw Error('At most one Todo may be in_progress');return todos;
}
export function reduceTodos(state,event){
 if(event.type==='todo/write'&&event.data.scrum?.version===1)return {initialized:true,todos:event.data.scrum.todos,protected:event.data.scrum.preserved===true};
 if(event.type==='todo/write'&&!state.initialized)return {...state,todos:event.data.todos.map(t=>({...t,id:idFor(t.content),priority:'medium'}))};
 if(event.type==='compaction/start')return {...state,protected:hasDetailedTodos(state.todos)};
 if(event.type==='compaction/end'&&event.data.error||event.type==='turn/end')return {...state,protected:false};
 return state;
}
export function selectTodoWrite(state,requested){
 if(state.protected&&hasDetailedTodos(state.todos)&&isAtlasBootstrapTodoList(requested))return {todos:state.todos,preserved:true};
 return {todos:requested,preserved:false};
}
export function todoState(ctx,agent){return ctx.sessionProjections.snapshot(agent.session,['scrumTodos']).values.scrumTodos}
const nativeRows=todos=>todos.filter(t=>t.status!=='cancelled').map(({content,status})=>({content,status}));
export function registerTodos(ctx,options={}){
 registerTodoFanout(ctx,options);
 ctx.sessionProjections.register({key:'scrumTodos',stateSchema,init:initialTodos,apply:reduceTodos,wire:{viewSchema:stateSchema,view:state=>state},stateVersion:1});
 const installed=new WeakSet();
 const install=agent=>{
  if(installed.has(agent)||!ctx.tools.schemas(agent).some(t=>t.name==='todo_write'))return;
  installed.add(agent);
  for(const name of ['todo_write','todowrite'])agent.ctx.tools.register(defineTool({name,description:TODOWRITE_DESCRIPTION+(name==='todo_write'?'\nNative compatibility: omitted priority defaults to medium.':''),parameters:{todos:{type:'array',required:true,items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},content:{type:'string',required:true},status:{type:'string',required:true,enum:statuses},priority:{type:'string',...(name==='todowrite'?{required:true}:{}),enum:priorities}}}}},output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},execute:async(args,exec)=>{
   if(exec.agent!==agent)throw Error('Todo owner mismatch');const previous=todoState(ctx,agent),selected=selectTodoWrite(previous,normalizeTodos(args.todos,{requirePriority:name==='todowrite'}));
   agent.session.append('todo/write',{todos:nativeRows(selected.todos),scrum:{version:1,todos:selected.todos,preserved:selected.preserved}});
   return JSON.stringify({...selected,operation:todoMutationOperation(previous,selected),notice:selected.preserved?'Detailed post-compaction Todo list retained instead of bootstrap replacement':undefined});
  }}));
 };
 ctx.on('agent/created',({agent})=>install(agent));for(const agent of ctx.agents.list())install(agent);
 ctx.on('agent/pre-step',async({agent},next)=>{const state=todoState(ctx,agent);if(state.initialized||state.todos.length){const current=ctx.sessionProjections.snapshot(agent.session,['todos']).values.todos,rows=nativeRows(state.todos);if(JSON.stringify(current)!==JSON.stringify(rows))agent.session.append('todo/write',{todos:rows})}return next()});
 ctx.systemPrompt.context({name:'scrum:durable-todos',order:135,text:input=>{const agent=input.agent||input.scope;if(!agent?.session)return '';const state=todoState(ctx,agent);return state.todos.length?'Current durable session Todo list (separate from canonical project tasks):\n'+JSON.stringify(state.todos):''}});
}
