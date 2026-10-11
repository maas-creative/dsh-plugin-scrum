import {checkComments,extractApplyPatchEdits} from './independent/comment-inspection.mjs';
export {checkComments};
export async function commentHint(exec,result,{enabled=true,custom_prompt}={}){
 if(!enabled||result?.isError)return null;
 const name=String(exec.name||'').toLowerCase(),args=exec.arguments||{};
 if(name==='apply_patch'){
  const messages=[];
  for(const change of extractApplyPatchEdits(result?.meta??result?.metadata??result?.value??result,args)){
   const message=await commentHint({...exec,name:change.before?'edit':'write',arguments:{file_path:change.filePath,...(change.before?{old_string:change.before,new_string:change.after}:{content:change.after})}},result,{enabled,custom_prompt});
   if(message)messages.push(message);
  }
  return messages.length?messages.join('\n\n'):null;
 }
 if(!['write','edit','multiedit','hashline_edit'].includes(name))return null;
 const path=args.file_path??args.filePath??args.path;if(typeof path!=='string')return null;
 const tool_input={file_path:path};
 for(const [field,keys]of Object.entries({content:['content'],old_string:['old_string','oldString'],new_string:['new_string','newString'],edits:['edits']})){
  const key=keys.find(key=>args[key]!==undefined);if(key)tool_input[field]=args[key];
 }
 if(name==='hashline_edit'){delete tool_input.edits;tool_input.new_string=(args.edits||[]).flatMap(edit=>edit.lines||[]).join('\n');tool_input.old_string='';}
 const checked=await checkComments({session_id:exec.agent?.session?.id||'unknown',cwd:exec.agent?.session?.header?.cwd||process.cwd(),tool_name:name==='hashline_edit'?'edit':name,transcript_path:'',hook_event_name:'PostToolUse',tool_input},{signal:exec.signal,customPrompt:custom_prompt});
 if(checked.incomplete||checked.failure)return 'Comment inspection did not complete: '+(checked.incomplete||checked.failure.stderr);
 return checked.hasComments?checked.message:null;
}
