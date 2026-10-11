import {setTimeout as delay} from 'node:timers/promises';
export async function backgroundOutput(runtime,args,parent){
 const id=args.assignmentId??args.task_id;
 const owned=()=>runtime.list().find(a=>a.id===id&&a.parentSession===parent);
 let assignment=owned();if(!assignment)throw Error('Background assignment is not owned by this parent');
 const timeout=args.timeout??60000;if(!Number.isFinite(timeout)||timeout<0||timeout>600000)throw Error('timeout must be between 0 and 600000 ms');
 const limit=args.message_limit??200;if(!Number.isSafeInteger(limit)||limit<0||limit>200)throw Error('message_limit must be between 0 and 200');
 const thinkingLimit=args.thinking_max_chars??2000;if(!Number.isSafeInteger(thinkingLimit)||thinkingLimit<0)throw Error('Invalid thinking_max_chars');
 const active=()=>['pending','preparing','running','retrying'].includes(assignment.status),deadline=Date.now()+timeout;
 while(args.block===true&&active()&&Date.now()<deadline){await delay(Math.min(100,deadline-Date.now()));await runtime.collect();assignment=owned();if(!assignment)throw Error('Background assignment disappeared');}
 if(!args.full_session)return args.block===true?{...assignment,timedOut:active()}:assignment;
 if(!runtime.pi?.readMessages)throw Error('Native transcript adapter unavailable');
 let messages=await runtime.pi.readMessages(assignment.runId);
 if(args.since_message_id){const index=messages.findIndex(m=>m.id===args.since_message_id);if(index<0)throw Error('since_message_id not found');messages=messages.slice(index+1)}
 messages=messages.filter(m=>args.include_tool_results===true||m.role!=='tool').map(m=>({...m,...(Array.isArray(m.content)?{content:m.content.filter(p=>(args.include_thinking===true||!['thinking','reasoning'].includes(p.type))&&(args.include_tool_results===true||!['tool_result','tool_use','tool'].includes(p.type))).map(p=>['thinking','reasoning'].includes(p.type)?{...p,...(typeof p.text==='string'?{text:p.text.slice(0,thinkingLimit)}:{}),...(typeof p.thinking==='string'?{thinking:p.thinking.slice(0,thinkingLimit)}:{})}:p)}:{})}));
 messages=args.from_end===true?(limit?messages.slice(-limit):[]):messages.slice(0,limit);
 return {...assignment,timedOut:args.block===true&&active(),messages};
}
