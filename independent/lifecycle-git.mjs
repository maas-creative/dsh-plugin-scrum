import {execFileSync} from 'node:child_process';
import {readFileSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';
function output(cwd,args){return execFileSync('git',args,{cwd,encoding:'utf8',timeout:10000,maxBuffer:32*1024*1024,stdio:['ignore','pipe','pipe']})}
export function run(cwd,args){return output(cwd,args).trim()}
export function gitToplevel(cwd){try{return run(cwd,['rev-parse','--show-toplevel'])}catch{return null}}
export function gitIsRepo(cwd){return gitToplevel(cwd)!==null}
export function gitHead(cwd){return run(cwd,['rev-parse','HEAD'])}
export function gitCommonDirRealpath(cwd){return realpathSync(resolve(cwd,run(cwd,['rev-parse','--git-common-dir'])))}
export function gitObjectType(cwd,ref){return run(cwd,['cat-file','-t',ref])}
function tracked(cwd){return output(cwd,['ls-files','-z']).split('\0').filter(Boolean)}
export function gitTrackedFileCount(cwd){return tracked(cwd).length}
export function gitTotalLoc(cwd){let total=0;for(const path of tracked(cwd)){try{const bytes=readFileSync(resolve(cwd,path));if(bytes.includes(0))continue;const text=bytes.toString('utf8');total+=(text.match(/\n/g)||[]).length+(text&& !text.endsWith('\n')?1:0)}catch{}}return total}
export function gitCommitsSince(cwd,ref){return Number(run(cwd,['rev-list','--count',ref+'..HEAD']))}
export function gitTouchedFilesSince(cwd,ref){return output(cwd,['diff','--name-only','-z',ref,'HEAD','--']).split('\0').filter(Boolean)}
export function gitChurnLoc(cwd,ref){let total=0;for(const row of run(cwd,['diff','--numstat',ref,'HEAD','--']).split('\n')){const [added,removed]=row.split('\t');if(/^\d+$/.test(added)&&/^\d+$/.test(removed))total+=Number(added)+Number(removed)}return total}
