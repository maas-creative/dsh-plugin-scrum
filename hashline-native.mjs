import {applyHashlineEdits} from './independent/hashline-edits.mjs';
import {normalizeHashlineEdits,canonicalizeFileText,restoreFileText} from './independent/file-edit-input.mjs';
import {mutateResource} from './guarded-resources.mjs';
export async function executeNativeHashline(ctx,args,exec,cwd){
 const filePath=args.file_path||args.filePath;if(typeof filePath!=='string'||!filePath.trim())throw Error('file_path or filePath is required');
 if(!Array.isArray(args.edits))throw Error('edits parameter must be an array');
 if(args.delete){if(args.edits.length||args.rename)throw Error('delete requires empty edits and no rename');return mutateResource(ctx,{kind:'delete',path:filePath},exec,cwd)}
 if(!args.edits.length)throw Error('edits parameter must be a non-empty array');
 const edits=normalizeHashlineEdits(args.edits).map(edit=>({...edit,lines:typeof edit.lines==='string'?edit.lines.split('\n'):edit.lines}));
 if(edits.some(edit=>!Array.isArray(edit.lines)||edit.lines.some(line=>typeof line!=='string')))throw Error('lines must be strings, string array, or null');
 const target=await ctx.fs.resolve(filePath,{cwd,signal:exec.signal}),info=await ctx.fs.stat(target,exec.signal);
 if(info&&info.type!=='file')throw Error('Not a regular file');
 if(!info&&!edits.every(edit=>['append','prepend'].includes(edit.op)&&!edit.pos))throw Error('File not found: '+filePath);
 const intent=info?await ctx.waterfall('fs/edit-intent',target,exec,()=>undefined):undefined;
 if(info&&!intent?.version)throw Error('File not observed; reread it');
 // Native text decoding drops BOM. Validate text, then retain its raw envelope.
 let raw='';if(info){raw=await ctx.fs.readText(target,exec.signal);if(ctx.fs.readBytes)raw=Buffer.from(await ctx.fs.readBytes(target,exec.signal,info.size)).toString('utf8')}
 const envelope=canonicalizeFileText(raw),after=applyHashlineEdits(envelope.content,edits);
 if(after===envelope.content&&!args.rename)throw Error('No changes made; edits produced identical content');
 const policy=ctx.get('sandboxPolicy')?.resolve(exec.agent?{session:exec.agent.session}:{});
 if(args.rename&&args.rename!==filePath&&!info){
  if(typeof ctx.fs.checkedTarget!=='function')throw Error('Create-and-rename requires sandbox target validation');
  await ctx.fs.checkedTarget(target,policy);
  if((await ctx.fs.lstat(args.rename,{cwd},exec.signal))?.type==='symlink')throw Error('Rename refuses symbolic links');
  const root=await ctx.fs.resolve(cwd,{signal:exec.signal}),destination=await ctx.fs.resolve(args.rename,{cwd,signal:exec.signal});
  if(!ctx.fs.contains(root,destination))throw Error('Resource outside working directory');
  await ctx.fs.checkedTarget(destination,policy);const destInfo=await ctx.fs.stat(destination,exec.signal),destIntent=destInfo?await ctx.waterfall('fs/edit-intent',destination,exec,()=>undefined):undefined;
  if(destInfo&&!destIntent?.version)throw Error('Rename destination not observed; reread it');
  const outcome=await ctx.fs.writeText(destination,restoreFileText(after,envelope),destInfo?{kind:'replaceIfVersion',version:destIntent.version}:{kind:'createIfAbsent'},exec.signal,policy);
  ctx.emit('fs/observed',destination,{kind:'present',version:outcome.version},exec);ctx.emit('fs/observed',target,{kind:'absent'},exec);return 'Moved '+filePath+' to '+args.rename;
 }
 if(args.rename&&args.rename!==filePath)await mutateResource(ctx,{kind:'rename',path:filePath,newPath:args.rename,overwrite:true,validateOnly:true},exec,cwd);
 const outcome=await ctx.fs.writeText(target,restoreFileText(after,envelope),info?{kind:'replaceIfVersion',version:intent.version}:{kind:'createIfAbsent'},exec.signal,policy);
 ctx.emit('fs/observed',target,{kind:'present',version:outcome.version},exec);
 if(args.rename&&args.rename!==filePath){try{return await mutateResource(ctx,{kind:'rename',path:filePath,newPath:args.rename,overwrite:true},exec,cwd)}catch(error){error.alreadyChanged=[target.displayPath,...(error.alreadyChanged||[])];error.message='Hashline rename failed after guarded source write; already changed: '+JSON.stringify(error.alreadyChanged)+'. '+error.message;throw error}}
 return 'Updated '+target.displayPath;
}
