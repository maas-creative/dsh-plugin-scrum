import {realpathSync,readlinkSync,lstatSync} from 'node:fs';
import {dirname,basename,resolve,relative,isAbsolute,sep} from 'node:path';
import {memoryLocation} from './memory.mjs';
import {registerMemoryFilesystemPolicy} from './independent/memory-filesystem-policy.mjs';

function canonical(path,depth=0){
 if(depth>40)throw Error('Memory path has too many symbolic links');
 try{return realpathSync(path);}catch(error){
  if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;
  try{if(lstatSync(path).isSymbolicLink())return canonical(resolve(dirname(path),readlinkSync(path)),depth+1);}catch(linkError){if(!['ENOENT','ENOTDIR'].includes(linkError.code))throw linkError;}
  const parent=dirname(path);return parent===path?path:resolve(canonical(parent,depth),basename(path));
 }
}
const ancestor=(parent,child)=>{const suffix=relative(parent,child);return suffix===''||suffix!=='..'&&!suffix.startsWith('..'+sep)&&!isAbsolute(suffix);};
const pathKeys=new Set(['file_path','filePath','path','paths','directory','cwd','workdir','target','destination','newPath','new_path','oldPath','old_path']);
function pathsFrom(arguments_){const paths=[];function visit(value,key){if(typeof value==='string'&&pathKeys.has(key))paths.push(value);else if(Array.isArray(value))for(const item of value)visit(item,key);else if(value&&typeof value==='object')for(const [child,item]of Object.entries(value))visit(item,child);}visit(arguments_);return paths;}

// File-tool guard and shell warning only. OS/process confinement is a separate
// host capability and must not be inferred from this advisory guard.
export function registerMemoryToolGuard(ctx,{location=memoryLocation}={}){
 const policies=new Map(),warned=new Set();
 const dispose=ctx.tools.guard(exec=>{
  const session=exec.agent?.session,cwd=session?.header?.cwd;if(!cwd)return;
  let policy=policies.get(cwd);if(!policy){const root=canonical(location({cwd}).directory);policy=registerMemoryFilesystemPolicy({registerFilesystemPolicy(){}},{identityPaths:{root},durableRoot:root});policies.set(cwd,policy);}
  const name=String(exec.name??'').toLowerCase(),args=exec.arguments||{};
  if(/^(bash|shell|terminal|pwsh|powershell)$/.test(name)){
   const command=String(args.command??args.script??'');
   const key=cwd+'\0'+(session.id||'unknown');
   if(!warned.has(key)&&policy.deniedRoots.some(root=>command.includes(root))){warned.add(key);if(warned.size>1000)warned.delete(warned.values().next().value);ctx.logger?.warn('Shell text references memory storage. File-tool identity guards do not confine shell processes; use the host sandbox.');}
   return;
  }
  const paths=pathsFrom(args);
  if(name==='apply_patch')for(const match of String(args.input??args.patch??'').matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to):\s*(.+)$/gm))paths.push(match[1]);
  const recursive=/glob|grep|search|find|list/.test(name);
  for(const input of paths){
   let path;try{path=canonical(resolve(cwd,input));}catch(error){return 'Cannot validate memory identity boundary: '+error.message;}
   const decision=policy.check({canonicalPath:path,operation:recursive?'enumerate':'read'});if(!decision.allow)return decision.reason;
   if(recursive&&policy.deniedRoots.some(root=>ancestor(path,root)))return 'cross-identity memory enumeration denied: '+path;
  }
 });
 ctx.effect?.(()=>()=>{dispose();policies.clear();warned.clear();});return {registered:true,scope:'file-tool soft guard; shell advisory'};
}
