import {join} from 'node:path';
import {statSync,existsSync} from 'node:fs';
import {readState,writeState,claim,hash} from './lifecycle-state.mjs';
import {computeCoverageRatio} from './independent/lifecycle-coverage.mjs';
import {computeDrift,shouldProposeRefresh} from './independent/lifecycle-drift.mjs';
import {gitToplevel,gitHead,gitCommonDirRealpath,gitTrackedFileCount,gitTotalLoc,run} from './independent/lifecycle-git.mjs';
export {computeCoverageRatio,computeDrift};
const day=86400000;
export class Onboarding {
 constructor(stateDir,{now=()=>Date.now()}={}){this.dir=stateDir;this.now=now;this.startedAt=now();this.forced=new Set()}
 start({interactive=false,resume=false,force=false,sessionId=''}){if(!interactive||resume)return {kind:'suppressed',reason:resume?'resume':'headless'};const path=join(this.dir,'onboarding-completed');if(force){if(this.forced.has(sessionId))return {kind:'suppressed',reason:'forced-already-shown'};this.forced.add(sessionId);return {kind:'redisplay'}}return claim(path,{version:1,completedAt:this.now()})?{kind:'first'}:{kind:'suppressed',reason:'completed'}}
 ready(){try{return statSync(join(this.dir,'onboarding-completed')).mtimeMs<this.startedAt}catch{return false}}
 status(){return {completed:readState(join(this.dir,'onboarding-completed')),startedAt:this.startedAt}}
}
export class InitDeepAdvisor {
 constructor(stateDir,{now=()=>Date.now()}={}){this.dir=join(stateDir,'init-deep-advisor');this.now=now}
 project(cwd){const root=gitToplevel(cwd);if(!root)return null;return {root,id:hash(gitCommonDirRealpath(root)),head:gitHead(root)}}
 status(cwd){const project=this.project(cwd);return project?{...project,state:readState(join(this.dir,project.id+'.json'),{}),globallyDeclined:Boolean(readState(join(this.dir,'global-decline.json')))}:{reason:'not-git'}}
 eligible(cwd){const status=this.status(cwd);if(!status.root||status.globallyDeclined||status.state.declined||this.now()<(status.state.cooldownUntil||0)||status.head===status.state.lastProposedHead)return null;const path=join(status.root,'.omo','init-deep.json'),snapshot=readState(path,null);let result;
 if(!existsSync(path)){const coverage=computeCoverageRatio(status.root);if(!coverage||coverage.missingRatio<0.5)return null;result={trigger:'coverage-gap',coverage}}
 else if(!snapshot||typeof snapshot.commitSha!=='string'||!['local','committed'].includes(snapshot.mode)||![snapshot.fileCount,snapshot.loc,snapshot.timestamp].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)){result={trigger:'snapshot-invalid',drift:{kind:'stale',stale:true}}}
 else {const drift=computeDrift(status.root,snapshot);drift.daysSince=(this.now()-snapshot.timestamp)/day;if(!shouldProposeRefresh(drift,status.head,status.state.lastProposedHead||null,0))return null;result={trigger:drift.kind==='stale'?'snapshot-invalid':drift.commitsSince>=30&&drift.touchedRatio>=.15?'commit-and-touch':drift.churnLocRatio>=.25?'loc-churn':'snapshot-age',drift}}
 return {...status,...result,suggestedMode:this.mode(status.root)}
 }
 mode(root){try{run(root,['ls-files','--error-unmatch','AGENTS.md']);return 'committed'}catch{return 'local'}}
 propose(cwd){const value=this.eligible(cwd);if(!value)return null;writeState(join(this.dir,value.id+'.json'),{...value.state,lastProposedHead:value.head,lastProposedAt:this.now()});return value}
 choose(cwd,choice){const project=this.project(cwd);if(!project)throw Error('Init-deep requires a Git project');const path=join(this.dir,project.id+'.json'),state=readState(path,{});if(choice==='never-global')writeState(join(this.dir,'global-decline.json'),{declinedAt:this.now()});else if(choice==='never-project')writeState(path,{...state,declined:true});else if(choice==='skip')writeState(path,{...state,cooldownUntil:this.now()+7*day});else if(choice==='run')return {skill:'init-deep',root:project.root,mode:this.mode(project.root)};else throw Error('Unknown init-deep choice');return {choice}}
 snapshot(cwd,mode='local'){const project=this.project(cwd);if(!project)throw Error('Init-deep requires Git');if(!['local','committed'].includes(mode))throw Error('Invalid init-deep mode');const snapshot={commitSha:project.head,fileCount:gitTrackedFileCount(project.root),loc:gitTotalLoc(project.root),timestamp:this.now(),mode};writeState(join(project.root,'.omo','init-deep.json'),snapshot);return snapshot}
}
