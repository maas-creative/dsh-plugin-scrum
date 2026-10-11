import {readFile,writeFile,rename,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {isAbsolute,resolve} from 'node:path';
const marker='// Scrum: session-owned additional directories share the filesystem and kernel allow-list.';
const anchor='\t\tpolicy.workspaceRoot,\n\t\t"/tmp",';
export async function installSandboxDirectoryCompatibility(){
 const path=createRequire(import.meta.url).resolve('@deepseek-ai/dsh-sandbox'),source=await readFile(path,'utf8');
 if(source.includes(marker)){if(!source.includes('Invalid Scrum writable roots'))throw Error('Incomplete DSH directory adapter; installation must be repaired');return {installed:false,path};}
 if(source.split(anchor).length!==2)throw Error('Unsupported DSH writableRoots implementation; directory grants unavailable');
 const replacement='\t\t'+marker+'\n\t\tpolicy.workspaceRoot,\n\t\t...(policy.scrumWritableRoots ?? []),\n\t\t"/tmp",';
 const start='\tif (policy.mode !== "workspace-write") return [];';
 if(source.split(start).length!==2)throw Error('Unsupported DSH writableRoots mode guard');
 const guard=start+'\n\tif (policy.scrumWritableRoots !== undefined && (!Array.isArray(policy.scrumWritableRoots) || policy.scrumWritableRoots.length > 300 || policy.scrumWritableRoots.some(root => typeof root !== "string" || !scrumIsAbsolute(root)))) throw new TypeError("Invalid Scrum writable roots");';
 const temporary=path+'.scrum-'+randomUUID()+'.tmp';try{await writeFile(temporary,'import {isAbsolute as scrumIsAbsolute} from "node:path";\n'+source.replace(anchor,replacement).replace(start,guard),{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}return {installed:true,path};
}
// Only the policy owner gets this adapter; model arguments cannot supply roots.
export function createSandboxDirectoryAdapter(ctx){
 const service=ctx.get?.('sandboxPolicy')||ctx.sandboxPolicy;
 if(!service?.resolve)return {supported:false,sync:()=>{throw Error('Additional directories require the native DSH sandbox policy provider');}};
 const original=service.resolve,roots=new WeakMap();
 const wrapped=function(request={}){const policy=original.call(this,request),extra=request.session&&roots.get(request.session);return extra?.length?{...policy,scrumWritableRoots:[...extra]}:policy;};
 service.resolve=wrapped;
 ctx.effect?.(()=>()=>{if(service.resolve===wrapped)service.resolve=original;});
 return {supported:true,sync:(agent,directories)=>{
  if(!Array.isArray(directories)||directories.length>300||directories.some(path=>typeof path!=='string'||!isAbsolute(path)))throw Error('Invalid effective additional directories');
  roots.set(agent.session,[...new Set(directories.map(path=>resolve(path)))]);
 }};
}
