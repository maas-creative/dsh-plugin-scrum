import {link,unlink,rename,rmdir} from 'node:fs/promises';
import {LocalFileSystem} from '@deepseek-ai/dsh-fs-local';
// Minimal extension of the local provider: share mutation locks and the sandbox
// target validator. Remote backends must implement their own resource seam.
export async function mutateResource(ctx,operation,exec,cwd){
 if(!['rename','delete'].includes(operation.kind))throw Error('Unsupported resource operation');
 const fs=ctx.fs;if(!(fs instanceof LocalFileSystem)||typeof fs.withLock!=='function')throw Error('Resource operations require the DSH local filesystem backend');
 const policy=ctx.get('sandboxPolicy')?.resolve(exec.agent?{session:exec.agent.session}:{}),root=await fs.resolve(cwd,{signal:exec.signal});
 const checked=async path=>{if((await fs.lstat(path,{cwd},exec.signal))?.type==='symlink')throw Error('Resource operations refuse final symbolic links');let target=await fs.resolve(path,{cwd,signal:exec.signal});if(!fs.contains(root,target))throw Error('Resource outside working directory');if(typeof fs.checkedTarget==='function')target=await fs.checkedTarget(target,policy);else if(policy&&policy.mode!=='danger-full-access')throw Error('Resource operation requires sandbox target validator');return target;};
 const source=await checked(operation.path),destination=operation.kind==='rename'?await checked(operation.newPath):null;
 if(destination?.targetKey===source.targetKey)return {applied:true,files:[]};
 const initial=await fs.stat(source,exec.signal);if(!initial){if(operation.ignoreIfNotExists)return {applied:true,files:[]};throw Error('Resource does not exist');}
 const tree=[];
 const scan=async target=>{const info=await fs.stat(target,exec.signal);if(!info||!['file','directory'].includes(info.type))throw Error('Unsupported resource type');tree.push({target,info});if(info.type==='directory'&&operation.kind==='delete'){if(!operation.recursive)throw Error('Directory deletion requires recursive');for(const entry of await fs.listDir(target,exec.signal)){const stat=await fs.lstat(entry.target.displayPath,{cwd},exec.signal);if(stat?.type==='symlink'||entry.type==='other')throw Error('Recursive resource deletion refuses symbolic links and special files');await scan(await checked(entry.target.displayPath));}}};
 await scan(source);
 const keys=[...new Set([...tree.map(item=>item.target.targetKey),...(destination?[destination.targetKey]:[])])].sort(),locked=(index,fn)=>index===keys.length?fn():fs.withLock(keys[index],()=>locked(index+1,fn));
 return locked(0,async()=>{
  const destInfo=destination?await fs.stat(destination,exec.signal):null;
  if(destInfo&&!operation.overwrite){if(operation.ignoreIfExists)return {applied:true,files:[]};throw Error('Resource destination already exists');}
  const verify=async(target,info)=>{const fresh=await checked(target.displayPath);if(fresh.targetKey!==target.targetKey)throw Error('Resource target changed');const current=await fs.stat(target,exec.signal),intent=await ctx.waterfall('fs/edit-intent',target,exec,()=>undefined);if(!current||!intent?.version||intent.version!==current.version||info&&info.version!==current.version)throw Error('Resource input stale or not observed; reread it');};
  for(const item of tree)await verify(item.target,item.info);
  if(destination){const fresh=await checked(operation.newPath);if(fresh.targetKey!==destination.targetKey)throw Error('Resource destination changed');if(destInfo)await verify(destination,destInfo);}
  exec.signal?.throwIfAborted();
  if(operation.validateOnly)return {applied:false,files:[]};
  const changed=[];
  try{
   if(destination){
    if(initial.type==='file'&&!destInfo){await link(fs.processPath(source),fs.processPath(destination));changed.push(destination.displayPath);await unlink(fs.processPath(source));}
    else{await rename(fs.processPath(source),fs.processPath(destination));changed.push(destination.displayPath);}
    changed.push(source.displayPath);ctx.emit('fs/observed',destination,{kind:'present',version:(await fs.stat(destination)).version},exec);ctx.emit('fs/observed',source,{kind:'absent'},exec);
   }else{
    for(const {target,info}of tree.reverse()){exec.signal?.throwIfAborted();if(info.type==='directory')await rmdir(fs.processPath(target));else await unlink(fs.processPath(target));changed.push(target.displayPath);ctx.emit('fs/observed',target,{kind:'absent'},exec);}
   }
   return {applied:true,files:changed};
  }catch(error){error.alreadyChanged=changed;error.message='Resource mutation failed; already changed: '+JSON.stringify(changed)+'. '+error.message;throw error;}
 });
}
