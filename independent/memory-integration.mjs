import {existsSync} from 'node:fs';
import {resolve} from 'node:path';

// Integration uses Git's three-way merge under the caller's repository writer
// lock. Its committed trailer is the crash-recovery receipt; the proposal must
// be an ancestor of a real merge commit before that receipt can be trusted.
export async function integrateValidatedReflection(context,{mode='auto',runId,summary,validated,withWriterLock=operation=>operation()}={}){
 if(!['auto','integration'].includes(mode)||typeof runId!=='string'||!/^[a-f0-9-]{36}$/.test(runId))throw Error('Invalid memory integration request');
 const tip=validated?.tipSha,base=context.baseSha;
 if(!/^[a-f0-9]{40,64}$/.test(tip??'')||!/^[a-f0-9]{40,64}$/.test(base??''))throw Error('Validated memory commits are required');
 const cwd=context.parent?.dir||context.dir;
 const run=async(args)=>context.exec.run(args,{cwd,timeoutMs:30000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_EDITOR:'true',GIT_MERGE_AUTOEDIT:'no'}});
 const requireGit=async args=>{const result=await run(args);if(result.code!==0)throw Error(result.stderr||'Git integration command failed');return result.stdout.trim();};
 const contains=async(ancestor,descendant)=>(await run(['merge-base','--is-ancestor',ancestor,descendant])).code===0;
 return withWriterLock(async()=>{
  const head=await requireGit(['rev-parse','HEAD']);
  const log=await requireGit(['log','HEAD','--format=%H%x00%B%x00','--extended-regexp',`--grep=^(Scrum|Omo)-Run: ${runId}$`]);
  const parts=log.split('\0');
  for(let i=0;i+1<parts.length;i+=2){const sha=parts[i].trim(),body=parts[i+1];if(!new RegExp(`^(?:Scrum|Omo)-Run: ${runId}$`,'m').test(body))continue;
   const parents=(await requireGit(['rev-list','--parents','-n','1',sha])).split(/\s+/);
   if(parents.length>=3&&await contains(base,sha)){if(await contains(tip,sha))return {outcome:'merged',integrationSha:sha};return {outcome:'failed',detail:'This integration run ID already belongs to a different proposal.'};}
  }
  if(await context.parent.status())return {outcome:'parent_dirty'};
  const activePath=await requireGit(['rev-parse','--git-path','MERGE_HEAD']);
  for(const state of ['MERGE_HEAD','CHERRY_PICK_HEAD','REVERT_HEAD','rebase-merge','rebase-apply']){const path=await requireGit(['rev-parse','--git-path',state]);if(existsSync(resolve(cwd,path)))return {outcome:'parent_dirty',detail:'An existing Git operation belongs to the caller and was not changed.'};}
  if(mode==='integration'&&head!==base)return {outcome:'failed',detail:'Parent revision changed; strict integration requires its original base.'};
  if(await contains(tip,head))return {outcome:'merged',integrationSha:head};
  const result=await run(['-c','user.name=Scrum Memory','-c','user.email=scrum-memory@localhost','merge','--no-ff','--no-edit','-m',`memory: integrate ${runId}\n\nScrum-Run: ${runId}`,tip]);
  if(result.code!==0){
   // Abort only a merge this invocation started. The pre-existing merge check
   // happened under the same writer lock before running Git.
   if(existsSync(resolve(cwd,activePath))){const aborted=await run(['merge','--abort']);if(aborted.code!==0)return {outcome:'failed',detail:'Integration failed and its merge could not be aborted: '+aborted.stderr};return {outcome:'merge_conflict',detail:result.stderr};}
   return {outcome:'failed',detail:result.stderr};
  }
  return {outcome:'merged',integrationSha:await requireGit(['rev-parse','HEAD'])};
 });
}
