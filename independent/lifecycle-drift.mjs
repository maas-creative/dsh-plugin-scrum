import {gitHead,gitObjectType,gitCommitsSince,gitTouchedFilesSince,gitTrackedFileCount,gitChurnLoc,gitTotalLoc} from './lifecycle-git.mjs';
export function computeDrift(cwd,snapshot){
 try{
  if(!snapshot||gitObjectType(cwd,snapshot.commitSha)!=='commit')return {kind:'stale',stale:true};
  gitHead(cwd);
  const commitsSince=gitCommitsSince(cwd,snapshot.commitSha),touchedFiles=gitTouchedFilesSince(cwd,snapshot.commitSha).length,trackedFiles=gitTrackedFileCount(cwd),churnLoc=gitChurnLoc(cwd,snapshot.commitSha),totalLoc=gitTotalLoc(cwd);
  return {kind:'valid',commitsSince,touchedFiles,trackedFiles,touchedRatio:trackedFiles?touchedFiles/trackedFiles:0,churnLoc,totalLoc,churnLocRatio:totalLoc?churnLoc/totalLoc:0,daysSince:(Date.now()-snapshot.timestamp)/86400000};
 }catch{return {kind:'stale',stale:true}}
}
export function shouldProposeRefresh(drift,head,lastHead,cooldownUntil=0){
 if(head===lastHead||Date.now()<cooldownUntil)return false;
 return drift?.kind==='stale'||(drift?.commitsSince>=30&&drift?.touchedRatio>=.15)||drift?.churnLocRatio>=.25||drift?.daysSince>=90;
}
