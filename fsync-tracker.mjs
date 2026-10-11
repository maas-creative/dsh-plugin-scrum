// Scrum durability diagnostics. A successful write is distinct from fsync support.
import{fsyncSync as nativeFsyncSync}from'node:fs';
let skips=[];
export function classifyPathEnvironment(path){const value=String(path).replaceAll('\\','/');if(value.includes('/Library/Mobile Documents/')||value.includes('/iCloud Drive/'))return'icloud';if(/(?:^|\/)OneDrive(?:[^/]*)(?:\/|$)/i.test(value))return'onedrive';if(value.startsWith('/Volumes/')||value.startsWith('//'))return'network-drive';return'unknown'}
export function describePathClassification(kind){return{icloud:'iCloud Drive',onedrive:'OneDrive','network-drive':'Network drive or mounted volume',unknown:'Filesystem with unsupported fsync'}[kind]||'Filesystem with unsupported fsync'}
export function recordFsyncSkip(entry){skips.push({...entry,timestamp:Date.now()});if(skips.length>200)skips=skips.slice(-200)}
export function drainSkipsAfter(timestampMs){const selected=skips.filter(entry=>entry.timestamp>timestampMs);skips=skips.filter(entry=>entry.timestamp<=timestampMs);return selected}
export function clearAllSkips(){skips=[]}
export function formatFsyncSkipWarning(entries){
 if(!entries.length)return'';
 const counts=new Map();for(const entry of entries)counts.set(entry.pathClassification,(counts.get(entry.pathClassification)||0)+1);
 const kind=[...counts].sort((a,b)=>b[1]-a[1])[0][0],paths=entries.slice(0,5).map(entry=>'  '+entry.filePath+' ('+entry.errorCode+')'),remaining=entries.length-paths.length;
 if(remaining)paths.push('  and '+remaining+' more');
 return`[fsync-skipped] ${entries.length} write(s) could not request filesystem synchronization.\n${describePathClassification(kind)}\n${paths.join('\n')}\nThe write was accepted, but power-loss durability is not confirmed by fsync. Mounted-volume classification does not prove a network filesystem.`;
}
export function tolerantFsyncSync(fd,contextLabel,fsyncImpl=nativeFsyncSync){try{fsyncImpl(fd)}catch(error){if(!(error instanceof Error)||!['EPERM','EACCES','ENOTSUP','EINVAL'].includes(error.code))throw error;const offset=contextLabel.indexOf(':'),filePath=offset<0?contextLabel:contextLabel.slice(offset+1);recordFsyncSkip({filePath,contextLabel,errorCode:error.code,message:error.message,pathClassification:classifyPathEnvironment(filePath)})}}
