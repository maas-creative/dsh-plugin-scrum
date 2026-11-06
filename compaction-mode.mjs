// Compaction mode is an execution property, not a role-name convention.
// Dashboard's parent session binds itself to EoCC explicitly; every other
// session defaults to SAC so a newly introduced worker cannot silently inherit
// the parent's long-context policy.
const modes=new WeakMap();
const NORMALIZED=new Set(['eocc','sac']);

export function bindCompactionMode(agent,mode){
 if(!agent||!NORMALIZED.has(mode))throw Error(`Unknown compaction mode: ${String(mode)}`);
 modes.set(agent,mode);
 return mode;
}

export function compactionModeFor(agent,fallback='sac'){
 const bound=modes.get(agent);
 if(bound)return bound;
 const explicit=agent?.options?.compactionMode||agent?.options?.sessionKind;
 if(explicit==='main'||explicit==='parent')return 'eocc';
 if(NORMALIZED.has(explicit))return explicit;
 // The safe default is SAC. Main sessions must opt into EoCC explicitly.
 return fallback;
}

export function isSacSession(agent){return compactionModeFor(agent)==='sac'}
