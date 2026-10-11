import {ThreadStore} from './thread.mjs';import {randomUUID} from 'node:crypto';
export async function callLookupAgent(runtime,args,parent){
 const role=args.subagent_type;if(!['explore','librarian'].includes(role))throw Error('call_omo_agent supports only explore and librarian');
 if(typeof args.prompt!=='string'||!args.prompt.trim()||args.prompt.length>20000)throw Error('Provide a bounded prompt');
 if(args.run_in_background!==true&&!runtime.threadAdapter?.waitForIdle)throw Error('Native wait capability unavailable');
 const threads=runtime.threads||=new ThreadStore(runtime.s,runtime.threadAdapter||{});
 let thread;if(args.session_id){thread=threads.get(args.session_id,parent);const priorRole=thread.role||runtime.s.setting('scrumThreadRole:'+thread.sessionId,null)||runtime.s.setting('runRole:'+thread.sessionId,null);if(priorRole!==role)throw Error('Lookup role cannot change on session reuse');}
 else thread=await threads.handle({method:'thread_create',args:{name:(args.description||role).slice(0,150)+' '+randomUUID().slice(0,8),subagent_type:role,cwd:runtime.threadCwd?.(parent),projectId:args.projectId||runtime.workpoolProject?.(parent)},parentSession:parent});
 if(!thread.role)thread=threads.save({...thread,role});
 await threads.handle({method:'thread_send',args:{thread:thread.id,message:args.prompt},parentSession:parent});
 if(args.run_in_background===true)return {queued:true,session_id:thread.sessionId,thread_id:thread.id,subagent_type:role};
 await runtime.threadAdapter.waitForIdle(thread.sessionId,new AbortController().signal);
 return {queued:false,session_id:thread.sessionId,thread_id:thread.id,output:await threads.handle({method:'thread_read',args:{thread:thread.id},parentSession:parent})};
}
