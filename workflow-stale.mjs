// Pinned boulder-state/storage/stale-work.ts: newest activity, inclusive threshold, future timestamps fresh.
export const defaultStaleWorkThresholdMs=6*60*60*1000;
export function staleWorkThresholdMs(env=process.env){const value=Number(env.OMO_BOULDER_STALE_WORK_THRESHOLD_MS);return Number.isFinite(value)&&value>0?value:defaultStaleWorkThresholdMs;}
export function staleWorkDecision(work,{now=Date.now(),thresholdMs=staleWorkThresholdMs(),activity=[]}={}){
 if(!['boulder','atlas'].includes(work.mode)||work.status!=='active')return null;
 const timestamps=[work.updated,work.created,...activity].map(value=>typeof value==='string'?Date.parse(value):value).filter(value=>Number.isFinite(value));
 const lastActivityMs=timestamps.length?Math.max(...timestamps):null;
 return lastActivityMs===null||now-lastActivityMs>=thresholdMs?{lastActivityMs,staleSince:new Date(now).toISOString()}:null;
}
