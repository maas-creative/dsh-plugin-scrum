import {readExecutionState,executionStopped} from './controller.mjs';
import {randomUUID} from 'node:crypto';
export const threadMethods=['thread_create','thread_list','thread_read','thread_send','thread_interrupt','thread_handoff','thread_rename','thread_set_model','thread_set_reasoning'];
export const threadText=(v,label,max=20000)=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} is required`);return v.trim()};
export class ThreadStore {
 constructor(store,adapter={}){this.s=store;this.adapter=adapter}
 list(parent,{allScope=false}={}){return this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumThread:%'").map(r=>JSON.parse(r.value)).filter(t=>allScope||t.parentSession===parent)}
 owner(sessionId){const matches=this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumThread:%'").map(r=>JSON.parse(r.value)).filter(t=>t.sessionId===sessionId);if(matches.length>1)throw Error('Ambiguous thread ownership');return matches[0]||null}
 get(address,parent,{allScope=false}={}){if(typeof address!=='string'||!address.trim())throw Error('Thread address required');const rows=this.list(parent,{allScope}),exact=rows.filter(t=>t.id===address||t.sessionId===address||t.name===address);if(exact.length===1)return exact[0];if(exact.length>1)throw Error('Ambiguous thread');const query=address.toLowerCase(),matches=rows.filter(t=>[t.id,t.sessionId,t.name].some(v=>typeof v==='string'&&v.toLowerCase().includes(query)));if(matches.length!==1)throw Error(matches.length?'Ambiguous thread':'Thread outside parent scope');return matches[0]}
 save(t){return this.s.tx(()=>{const old=this.s.setting('scrumThread:'+t.id,null);if(old){const history=new Map([...(old.history||[]),...(t.history||[])].map(m=>[m.id,m]));t.history=[...history.values()]}this.s.set('scrumThread:'+t.id,t);return t})}
 async capability(name,...args){if(typeof this.adapter[name]!=='function')throw Error(`Unsupported thread capability: ${name}`);return this.adapter[name](...args)}
 async operation(parent,caller,method,args,fn){const id=args.idempotency_key||args.operationId||randomUUID(),key='scrumThreadReceipt:'+parent+':'+id;const prior=this.s.setting(key,null),signature=JSON.stringify({caller,method,args});if(prior){if(prior.signature!==signature)throw Error('Operation ID conflict');if(prior.status==='completed')return prior.result;throw Error('Previous operation outcome uncertain; reconcile before retry')}
 this.s.tx(()=>this.s.set(key,{id,parentSession:parent,caller,method,signature,status:'pending',created:Date.now()}));try{const result=await fn(id);this.s.set(key,{...this.s.setting(key),status:'completed',result,completed:Date.now()});return result}catch(error){this.s.set(key,{...this.s.setting(key),status:'failed',error:error.message});throw error}}
 async handle({method,args={},parentSession,callerSession}){
 if(!threadMethods.includes(method))return undefined;if(!parentSession)throw Error('Parent required');const caller=callerSession||parentSession;
 if(executionStopped(readExecutionState(this.s,parentSession))&&['thread_create','thread_send','thread_handoff'].includes(method))throw Error('Stopped parent cannot start thread work');
 if(caller!==parentSession&&!this.list(parentSession).some(t=>t.sessionId===caller))throw Error('Caller outside parent');
 if(args.all_scope&&caller!==parentSession)throw Error('Only lead may read all scopes');
 if(method==='thread_list')return this.list(parentSession,{allScope:args.all_scope===true});
 const op=method.slice(7);
 if(op==='create')return this.operation(parentSession,caller,method,args,async id=>{const name=threadText(args.name||'Thread '+id.slice(0,8),'Name',200);if(this.list(parentSession).some(t=>t.name.toLowerCase()===name.toLowerCase()))throw Error('Name conflict');const session=await this.capability('create',{...args,name,parentSession,operationId:id});if(!session?.sessionId)throw Error('Adapter must return sessionId');return this.save({id:randomUUID(),sessionId:session.sessionId,endpoint:session.endpoint||null,parentSession,name,cwd:session.cwd||args.cwd||'',status:'active',model:session.model||null,reasoning:session.reasoning||null,history:[],created:Date.now()})});
 if(args.all_scope&&op!=='read')throw Error('All-scope access is read-only');
 const t=this.get(args.thread||args.id,parentSession,{allScope:op==='read'&&args.all_scope===true});
 if(op==='read'){const result=await this.capability('read',t,args);return {thread:t,result}}
 if(caller!==parentSession&&caller!==t.sessionId&&['interrupt','rename','set_model','set_reasoning'].includes(op))throw Error('Only lead or thread owner may mutate thread');
 return this.operation(parentSession,caller,method,args,async id=>{
 let result;
 if(op==='send'||op==='handoff'){const message=threadText(args.message||args.prompt,'Message');result=await this.capability(op,t,{...args,message,callerSession:caller,operationId:id});t.history.push({id,from:caller,type:op,message,result,created:Date.now()})}
 else if(op==='interrupt'){result=await this.capability('interrupt',t,{...args,operationId:id});t.status='interrupted'}
 else if(op==='rename'){const name=threadText(args.name,'Name',200);if(this.list(parentSession).some(x=>x.id!==t.id&&x.name.toLowerCase()===name.toLowerCase()))throw Error('Name conflict');result=await this.capability('rename',t,{...args,name});t.name=name}
 else if(op==='set_model'){threadText(args.model,'Model',200);result=await this.capability('setModel',t,args);t.model=result?.model||{provider:args.provider,model:args.model}}
 else if(op==='set_reasoning'){const level=threadText(args.level,'Reasoning',40);if(args.scope&&!['turn','session'].includes(args.scope))throw Error('Invalid reasoning scope');result=await this.capability('setReasoning',t,args);if(args.scope!=='turn')t.reasoning=level}
 t.updated=Date.now();this.save(t);return {thread:t,result,operationId:id};
 });
 }
}
export async function handleThread(runtime,request){const threads=runtime.threads||new ThreadStore(runtime.s,runtime.threadAdapter||{});return threads.handle(request)}
