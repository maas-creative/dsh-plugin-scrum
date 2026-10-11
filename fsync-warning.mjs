import {recordFsyncSkip,drainSkipsAfter,clearAllSkips,formatFsyncSkipWarning} from './fsync-tracker.mjs';
export * from './fsync-tracker.mjs';
import {sourceHookEnabled} from './source-hook-policy.mjs';
export const FSYNC_SKIP_START_TTL_MS=60000;
export function registerFsyncWarning(ctx,{readConfiguration,now=Date.now}={}){
 const starts=new Map();let closed=false;
 const prune=()=>{for(const [id,time]of starts)if(now()-time>FSYNC_SKIP_START_TTL_MS)starts.delete(id)};
 const timer=setInterval(prune,FSYNC_SKIP_START_TTL_MS);timer.unref?.();
 ctx.on('tools/execute',async(exec,next)=>{if(closed)return next();prune();starts.set(exec.callId,now());try{return await next()}catch(error){starts.delete(exec.callId);throw error}});
 ctx.on('tools/post-execute',async(exec,value,next)=>{const prior=await next(),start=starts.get(exec.callId)??0;starts.delete(exec.callId);if(closed||prior.kind!=='accept'||!value?.content?.some(block=>block.type==='text'))return prior;const entries=drainSkipsAfter(start);if(!sourceHookEnabled(exec.agent,'fsync-skip-warning',readConfiguration))return prior;const warning=formatFsyncSkipWarning(entries);if(!warning)return prior;return {...prior,content:[...(prior.content||value.content),{type:'text',text:'\n\n'+warning}]};});
 const dispose=()=>{closed=true;clearInterval(timer);starts.clear();clearAllSkips()};ctx.effect?.(()=>dispose);return {dispose,hasStart:id=>starts.has(id),prune};
}
