import {mkdirSync,writeFileSync,renameSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';

// Claude-compatible JSONL projection of the public DSH message history.
// Keep the native session unchanged; rebuild after compaction and cold resume.
export function writeClaudeTranscript(agent,{home=homedir()}={}){
 if(typeof agent.session.deriveMessages!=='function')return undefined;
 const dir=join(home,'.claude','transcripts'),id=createHash('sha256').update(agent.session.id).digest('hex'),path=join(dir,id+'.jsonl');
 mkdirSync(dir,{recursive:true,mode:0o700});
 const content=blocks=>typeof blocks==='string'?[{type:'text',text:blocks}]:(blocks||[]).flatMap(block=>{
  if(block.type==='text')return [{type:'text',text:block.text}];
  if(block.type==='tool-call'){let input;try{input=JSON.parse(block.arguments);}catch{input={_unparsed_arguments:block.arguments};}return [{type:'tool_use',id:block.id,name:block.name,input}];}
  return [];
 });
 const rows=agent.session.deriveMessages().map(message=>{const tool=message.role==='tool',role=tool?'user':message.role;return {type:role,sessionId:agent.session.id,message:{role,content:tool?[{type:'tool_result',tool_use_id:message.toolCallId,is_error:message.isError===true,content:content(message.content)}]:content(message.content)},...(message.id?{uuid:message.id}:{})};});
 const temporary=path+'.'+randomUUID()+'.tmp';
 try{writeFileSync(temporary,rows.map(row=>JSON.stringify(row)).join('\n')+(rows.length?'\n':''),{mode:0o600,flag:'wx'});renameSync(temporary,path);}finally{rmSync(temporary,{force:true});}
 return path;
}
