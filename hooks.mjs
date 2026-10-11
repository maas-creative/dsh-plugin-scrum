import {decorateHashlineRead,bashReadHint} from './editing-contracts.mjs';
import {loadScrumConfiguration,configurationAllows} from './configuration.mjs';
import {formatMutation} from './formatter.mjs';
import {resizeReadImages} from './read-images.mjs';
import {commentHint} from './comment-checker.mjs';
import {planFormatHint} from './plan-format.mjs';
import {interactiveWarning} from './noninteractive.mjs';
import {createNotepadWriteGuardHook} from './independent/tool-recovery.mjs';
import {createJsonErrorRecoveryHook} from './independent/tool-recovery.mjs';
import {createEditErrorRecoveryHook,EDIT_ERROR_REMINDER} from './independent/tool-recovery.mjs';
import {createEmptyTaskResponseDetectorHook} from './independent/tool-recovery.mjs';
import * as spillPolicy from '@deepseek-ai/dsh-spill-policy';

export const hookCompatibility=Object.freeze({
 contextWindow:{owner:'DSH compaction-basic',behavior:'agent/pre-step pressure and agent/request-error context-overflow recovery; do not rewrite saved history'},
 emptyContent:{owner:'DSH llm-retry and provider adapters',behavior:'content-less completion retry and provider-valid history serialization; do not fabricate placeholder assistant messages'},
 modelRecovery:{owner:'DSH llm-retry + Scrum models.mjs',behavior:'provider request retries; no tool replay or automatic model switch after mutation'},
 outputRetention:{owner:'DSH spill-policy + spillStore',behavior:'recoverable full text storage and token-bound result/PTC log projection'},
 claudeHooks:{owner:'Scrum public DSH hooks',behavior:'opt-in configured shell/HTTP hooks with input revalidation; native deny/cancel and tool guards remain effective'},
});
const registered=new WeakSet();
const textOf=result=>(result.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n');
export function staleInputHint(exec,result){
 if(!result.isError)return null;
 const text=textOf(result);
 if(exec.name==='hashline_edit'&&/mismatch|stale|changed|hash|一致|古い/i.test(text))return 'The hashline input is stale. Reread the affected file with hashline_read, inspect the current content, and construct fresh line references. The failed edit is not reported as a successful mutation.';
 if(/^(browser|computer)_/.test(exec.name)&&/suspended|human resume|not connected|not open|owner lease|emergency stop/i.test(text))return 'The operation did not complete. Inspect connection, ownership and stop status. A suspended session requires an explicit human resume; never reconnect or acquire another session to bypass the stop.';
 return null;
}
const notepadGuard=createNotepadWriteGuardHook();
const errorHooks=[['json-error-recovery',createJsonErrorRecoveryHook({})],['edit-error-recovery',createEditErrorRecoveryHook({})]];
const emptyTaskHook=createEmptyTaskResponseDetectorHook({});
const configFor=exec=>loadScrumConfiguration({cwd:exec.agent?.session.header?.cwd||process.cwd()}).config;
const hookEnabled=(config,name)=>configurationAllows(config,'hooks',name);
export async function errorRecoveryHint(exec,result,config=configFor(exec)){
 const original=textOf(result),output={title:'',output:original,metadata:{}};
 if(hookEnabled(config,'edit-error-recovery')&&exec.name.toLowerCase()==='edit'&&result.isError&&!original.includes('[EDIT ERROR - IMMEDIATE ACTION REQUIRED]')&&/old_string (?:was not found|matched \d+ times|must be a non-empty string)/.test(original))return EDIT_ERROR_REMINDER.trim();
 for(const [name,hook]of errorHooks)if(hookEnabled(config,name))await hook['tool.execute.after']({tool:exec.name,sessionID:exec.agent?.session.id,callID:exec.callId},output);
 return output.output===original?null:output.output.slice(original.length).trim();
}
// Notifications are host callbacks; these hooks never decide permissions or replay a tool.
export function registerHooks(ctx,{notify=()=>{},maxInlineTokens,commentChecker,formatter}={}){
 if(registered.has(ctx))return {registered:false,compatibility:hookCompatibility};
 if(maxInlineTokens!==undefined){if(!Number.isSafeInteger(maxInlineTokens)||maxInlineTokens<0)throw Error('Invalid output retention budget');if(!ctx.get('spillStore'))throw Error('Output retention requires a real DSH spillStore');ctx.plugin(spillPolicy,{maxInlineTokens})}
 registered.add(ctx);
 ctx.on('tools/pre-execute',async(exec,next)=>{const prior=await next();if(!['allow','ask'].includes(prior.kind)||!hookEnabled(configFor(exec),'notepad-write-guard'))return prior;try{await notepadGuard['tool.execute.before']({tool:exec.name},{args:exec.arguments});return prior;}catch(error){return {kind:'deny',reason:error.message};}});

 const send=event=>{try{Promise.resolve(notify(event)).catch(e=>ctx.logger?.warn('Scrum hook notification failed: '+e.message))}catch(e){ctx.logger?.warn('Scrum hook notification failed: '+e.message)}};
 ctx.on('tools/post-execute',async(exec,result,next)=>{
  const decision=await next();if(decision.kind!=='accept'||Object.hasOwn(decision,'value'))return decision;
  const config=configFor(exec),enabled=name=>hookEnabled(config,name);let planHint,comments,formatted;
  try{formatted=await formatMutation(ctx,exec,result,formatter)}catch(error){return {kind:'block',feedback:[...result.content,{type:'text',text:'The mutation ran, but required formatting failed: '+error.message+'. Inspect the current file before retrying.'}]}}
  if(enabled('plan-format-validator'))try{planHint=await planFormatHint(ctx,exec,result)}catch(error){planHint='Plan validation did not complete: '+error.message}
  if(enabled('comment-checker'))try{comments=await commentHint(exec,result,commentChecker)}catch(error){comments='Comment inspection did not complete: '+error.message}
  const hints=[formatted,planHint,comments,enabled('bash-file-read-guard')?bashReadHint(exec):null,enabled('non-interactive-env')&&exec.name==='bash'?interactiveWarning(exec.arguments?.command):null,staleInputHint(exec,result),await errorRecoveryHint(exec,result,config)].filter(Boolean);
  if(enabled('empty-task-response-detector')&&!result.isError){
   const output={title:'',output:textOf({...result,content:decision.content??result.content}),metadata:{}};
   await emptyTaskHook['tool.execute.after']({tool:exec.name,sessionID:exec.agent?.session.id,callID:exec.callId},output);
   if(output.output&&output.output!==textOf({...result,content:decision.content??result.content}))hints.push(output.output);
  }
  const imageContent=enabled('read-image-resizer')?await resizeReadImages(ctx,exec,{...result,content:decision.content??result.content}):null;
  const hashline=enabled('hashline-read-enhancer')&&exec.name.toLowerCase()==='read'&&!result.isError&&config.hashline_edit===true;
  const content=decorateHashlineRead(imageContent??decision.content??result.content,hashline);
  if(!hints.length)return imageContent||hashline?{...decision,content}:decision;
  return {...decision,content:[...content,{type:'text',text:hints.join('\n\n')}]};
 });
 ctx.on('tools/execute',async(exec,next)=>{
  const shell=/^(bash|powershell|pwsh|command_monitor_start|terminal_open)$/.test(exec.name);
  const identity={sessionId:exec.agent?.session.id,toolName:exec.name,callId:exec.callId};
  if(shell)send({kind:'shell-start',...identity});if(exec.name==='bash'&&hookEnabled(configFor(exec),'non-interactive-env')){const warning=interactiveWarning(exec.arguments?.command);if(warning)send({kind:'interactive-command-warning',...identity,warning})}
  const abort=()=>send({kind:'tool-canceled',...identity});exec.signal?.addEventListener('abort',abort,{once:true});if(exec.signal?.aborted)abort();
  try{const result=await next();if(shell)send({kind:'shell-dispatched',...identity,isError:result.isError===true});return result}finally{exec.signal?.removeEventListener('abort',abort)}
 });
 ctx.on('session/event',(session,event)=>{if(['approval/asked','approval/decided'].includes(event.type))send({kind:event.type,sessionId:session.header.id,...event.data})});
 return {registered:true,compatibility:hookCompatibility};
}
