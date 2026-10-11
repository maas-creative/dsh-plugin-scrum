// Admission policy for optional, read-only memory advice.
export function createAcceptedNudgeCooldown({now=Date.now,limit=2,windowMs=600000}={}){
 const timestamps=[];const purge=()=>{while(timestamps.length&&now()-timestamps[0]>=windowMs)timestamps.shift();};
 return {limit,windowMs,exhausted:()=>{purge();return timestamps.length>=limit;},charge:()=>{purge();timestamps.push(now());},charges:()=>{purge();return timestamps.length;}};
}
export function decideWake({candidates=[],offered=new Set(),surfaced=new Set(),maxItems=3,cooldown}={}){
 if(maxItems<=0)return {wake:false,reason:'max_items_zero'};
 const fresh=candidates.filter(row=>typeof row.path==='string'&&!row.path.startsWith('system/')&&!offered.has(row.path)&&!surfaced.has(row.path));
 if(!fresh.length)return {wake:false,reason:'no_new_candidate'};
 if(cooldown?.exhausted())return {wake:false,reason:'cooldown'};
 return {wake:true,candidates:fresh.slice(0,maxItems)};
}
export const backoffDelayMs=(failures,random=Math.random)=>Math.min(300000,Math.max(1000,Math.round(2**Math.min(Math.max(0,failures),20)*500*(1+Math.min(1,Math.max(0,random()))))));
export function createWakeToolBudget(limit=8){if(!Number.isSafeInteger(limit)||limit<1)throw Error('Invalid memory advisor tool budget');let used=0;return {limit,get used(){return used},charge:()=>used<limit?(used++,true):false};}
export function resolveKibitzerSidecarSettings(settings={}){return {toolBudget:settings.tool_budget??8,sidecarMaxTokens:settings.sidecar_max_tokens??48000,maxConcurrentWakes:settings.max_concurrent_wakes??2,eventCaps:{tool_args:400,result_head:600,assistant:1500,prompt:4000,...settings.event_caps},queryExpansion:settings.query_expansion??false};}
