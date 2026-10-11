import {apply as applySpillPolicy} from '@deepseek-ai/dsh-spill-policy';
import {formatSpillNotice} from '@deepseek-ai/dsh-spill-policy/notice';
import {loadScrumConfiguration,configurationAllows} from './configuration.mjs';
import {DEFAULT_MAX_TOKENS,TRUNCATABLE_TOOLS,TOOL_SPECIFIC_MAX_TOKENS} from './independent/tool-retention-policy.mjs';
const registered=new WeakSet();
export function sourceToolBudget(config,name){const originalName=name==='web_fetch'?'webfetch':name;return configurationAllows(config,'hooks','tool-output-truncator')&&(config.experimental?.truncate_all_tool_outputs===true||TRUNCATABLE_TOOLS.includes(originalName))?(TOOL_SPECIFIC_MAX_TOKENS[originalName]??DEFAULT_MAX_TOKENS):null}
export function registerToolRetention(ctx,{configuration=exec=>loadScrumConfiguration({cwd:exec.agent?.session.header.cwd||process.cwd()}).config}={}){
 if(registered.has(ctx))return {registered:false};registered.add(ctx);const policies=new Map();
 const budget=async exec=>{let cap=sourceToolBudget(configuration(exec),exec.name);if(cap===null)return null;
  try{const meter=ctx.get('tokenMeter'),llm=ctx.get('llm'),agent=exec.agent,route=agent?.session.requestHeader?.()?.config||agent?.options;if(meter&&llm&&agent&&route?.provider&&route.model){const model=await llm.resolveModelInfo(route.provider,route.model,exec.signal),used=meter.measure(agent.session).totalTokens;if(Number.isFinite(model.contextWindow)&&Number.isFinite(used))cap=Math.min(cap,Math.max(0,Math.floor((model.contextWindow-used)*0.5)))}}catch(error){ctx.logger?.warn('Scrum retention context usage unavailable: '+error.message)}return cap;
 };
 const handlers=(cap,readAlias=false)=>{const key=cap+':'+readAlias;if(!policies.has(key)){const callbacks={};applySpillPolicy({get:name=>{const service=ctx.get(name);return name==='spillStore'&&readAlias&&service?{saveText:input=>service.saveText({...input,source:{...input.source,toolName:input.source.toolName==='Read'?'read':input.source.toolName}})}:service},logger:ctx.logger,on:(name,handler)=>callbacks[name]=handler},{maxInlineTokens:cap});if(policies.size>=32)policies.delete(policies.keys().next().value);policies.set(key,callbacks)}return policies.get(key)};
 const exhausted=async(exec,content,name,callId)=>{if(!content.every(block=>block.type==='text'))return content;try{const full=content.map(block=>block.text).join(''),ref=await ctx.get('spillStore').saveText({owner:{sessionId:exec.agent.session.header.id},source:{kind:'tool',toolName:name,callId,label:'context-exhausted'},suggestedName:name+'.txt',content:full});return [{type:'text',text:'[Output suppressed - context window exhausted]\n'+formatSpillNotice({kind:'exact',count:Buffer.byteLength(full)},ref)}]}catch(error){ctx.logger?.warn('Scrum exhausted retention unavailable: '+error.message);return content}};
 // Append: the native prepended baseline wraps this source projection, retaining
 // its own deployment budget when this hook is disabled or ineligible.
 ctx.on('tools/post-execute',async(exec,result,next)=>{const cap=await budget(exec);if(cap===null)return next();if(cap===0){const decision=await next();return decision.kind!=='accept'||Object.hasOwn(decision,'value')||exec.parent!==undefined?decision:{...decision,content:await exhausted(exec,decision.content??result.content,exec.name,exec.callId)}}return handlers(cap,exec.name==='read')['tools/post-execute'](exec.name==='read'?{...exec,name:'Read'}:exec,result,next)});
 ctx.on('tools/ptc-dispatch-log',async(dispatch,next)=>{const cap=await budget({...dispatch.exec,name:dispatch.name});return cap===null?next():cap===0?exhausted(dispatch.exec,await next(),dispatch.name,dispatch.subCallId):handlers(cap)['tools/ptc-dispatch-log'](dispatch,next)});
 ctx.effect?.(()=>()=>policies.clear());return {registered:true};
}
