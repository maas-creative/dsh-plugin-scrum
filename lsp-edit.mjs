import {normalizeTextEdits} from './independent/lsp-text-edits.mjs';
import {mutateResource} from './guarded-resources.mjs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {withLspClient,parseLspRequestContext,runWithRequestContext} from './independent/lsp-client.mjs';
export {parseLspRequestContext as parseEditLspRequestContext,runWithRequestContext as runWithEditLspRequestContext};
export async function applyLspTextEdits(ctx,editsByFile,exec,cwd,{requireObserved=false,before=new Map()}={}){
 const root=await ctx.fs.resolve(cwd,{signal:exec.signal}),pending=[];
 for(const [path,edits] of editsByFile){
  const target=await ctx.fs.resolve(path,{cwd,signal:exec.signal});if(!ctx.fs.contains(root,target))throw Error('LSP edit outside working directory');
  const info=await ctx.fs.stat(target,exec.signal);if(info?.type!=='file')throw Error('LSP resource creation/deletion is preview-only');
  const original=await ctx.fs.readText(target,exec.signal),captured=before.get(path);
  if(captured&&(info.version!==captured.version||original!==captured.text))throw Error('LSP document changed during request');
  const intent=await ctx.waterfall('fs/edit-intent',target,exec,()=>undefined);
  if(requireObserved&&!intent?.version)return {applied:false,previewOnly:true,reason:'Read every affected file through DSH before applying a workspace rename',editFiles:[...editsByFile.keys()]};
  if(intent?.version&&intent.version!==info.version)throw Error('LSP input is stale; reread affected files');
  const text=normalizeTextEdits(original,edits,0).text;if(text!==original)pending.push({target,text,version:info.version});
 }
 const changed=[];
 try{for(const item of pending){const policy=ctx.get('sandboxPolicy')?.resolve(exec.agent?{session:exec.agent.session}:{});const result=await ctx.fs.writeText(item.target,item.text,{kind:'replaceIfVersion',version:item.version},exec.signal,policy);ctx.emit('fs/observed',item.target,{kind:'present',version:result.version},exec);changed.push(item.target.displayPath)}}catch(error){throw Error(`LSP write failed; already changed: ${JSON.stringify(changed)}. ${error.message}`)}
 return {applied:true,versionChecked:true,files:changed};
}
export async function executeGuardedLspEdit(ctx,name,args,exec,cwd){
 const root=await ctx.fs.resolve(cwd,{signal:exec.signal});
 const input=await ctx.fs.resolve(args.filePath,{cwd,signal:exec.signal});
 if(!ctx.fs.contains(root,input))throw Error('LSP input outside working directory');
 const validatedPath=ctx.fs.processPath(input);
 if(typeof validatedPath!=='string'||!validatedPath)throw Error('LSP requires a host-mapped filesystem path');
 return withLspClient(validatedPath,async(client,_root,path)=>{
  if(name==='format'){
   const target=await ctx.fs.resolve(path,{cwd,signal:exec.signal}),info=await ctx.fs.stat(target,exec.signal),source=await ctx.fs.readText(target,exec.signal);
   if(info?.type!=='file')throw Error('Formatting requires an existing file');
   if(args.expectedVersion&&args.expectedVersion!==info.version)throw Error('Formatter input changed before LSP request');
   const edits=await client.formatDocument(path,{tabSize:4,insertSpaces:false,trimTrailingWhitespace:true,insertFinalNewline:true,trimFinalNewlines:true},exec.signal);
   if(edits===null)return {status:'unavailable',applied:false,reason:'capability_not_advertised'};
   const result=await applyLspTextEdits(ctx,new Map([[path,edits]]),exec,cwd,{before:new Map([[path,{version:info.version,text:source}]])});if(result.applied)await client.openFile(path);return result;
  }
  // Request the rename directly without the upstream mutation lease. The server's
  // workspace/applyEdit handler therefore refuses side effects; only returned edits are eligible.
  await client.openFile(path);
  const edit=await client.sendRequest('textDocument/rename',{textDocument:{uri:pathToFileURL(path).href},position:{line:args.line-1,character:args.character},newName:args.newName},{signal:exec.signal});
  if(!edit)return {applied:false,previewOnly:true,reason:'No rename edits returned'};
  if(Object.values(edit.changeAnnotations||{}).some(annotation=>annotation.needsConfirmation))return {applied:false,previewOnly:true,reason:'Annotated LSP changes require explicit review',edit};
  const files=new Map();
  if(edit.documentChanges?.some(change=>change.kind)){
   if(Object.keys(edit.changes||{}).length)throw Error('Ambiguous LSP changes and resource operations');
   for(const change of edit.documentChanges){if(change.kind&&!['create','rename','delete'].includes(change.kind))throw Error('Unknown LSP resource operation');}
   const changed=[];
   try{
   // Preserve protocol order: a rename changes the URI used by subsequent edits.
   for(const change of edit.documentChanges){
    if(change.kind==='create'){
     const file=fileURLToPath(change.uri);if((await ctx.fs.lstat(file,{cwd},exec.signal))?.type==='symlink')throw Error('LSP resource operations refuse final symbolic links');const target=await ctx.fs.resolve(file,{cwd,signal:exec.signal});if(!ctx.fs.contains(root,target))throw Error('LSP resource outside working directory');
     const existing=await ctx.fs.stat(target,exec.signal);let expected={kind:'createIfAbsent'};
     if(existing){if(!change.options?.overwrite){if(change.options?.ignoreIfExists)continue;throw Error('LSP create destination exists');}const intent=await ctx.waterfall('fs/edit-intent',target,exec,()=>undefined);if(!intent?.version||intent.version!==existing.version)throw Error('LSP create overwrite stale or unobserved');expected={kind:'replaceIfVersion',version:existing.version};}
     const policy=ctx.get('sandboxPolicy')?.resolve(exec.agent?{session:exec.agent.session}:{}),written=await ctx.fs.writeText(target,'',expected,exec.signal,policy);ctx.emit('fs/observed',target,{kind:'present',version:written.version},exec);changed.push(file);
    }else if(change.kind==='rename'||change.kind==='delete'){
     const file=fileURLToPath(change.kind==='rename'?change.oldUri:change.uri);
     
     const result=await mutateResource(ctx,{...change.options,kind:change.kind,path:file,...(change.kind==='rename'?{newPath:fileURLToPath(change.newUri)}:{})},exec,cwd);changed.push(...result.files);
    }else if(change.kind)throw Error('Unknown LSP resource operation');
    else{const file=fileURLToPath(change.textDocument.uri);if(change.textDocument.version!=null&&client.getOpenDocumentVersion(file)!==change.textDocument.version)throw Error('Unverified LSP document version');const result=await applyLspTextEdits(ctx,new Map([[file,change.edits]]),exec,cwd,{requireObserved:true});if(!result.applied)return {...result,alreadyChanged:changed,edit};changed.push(...result.files);}
   }
   return {applied:true,versionChecked:true,files:changed,edit};
   }catch(error){throw Error('LSP resource operation failed; already changed: '+JSON.stringify([...changed,...(error.alreadyChanged||[])])+'. '+error.message)}
  }
  for(const [uri,edits] of Object.entries(edit.changes||{}))files.set(fileURLToPath(uri),edits);
  for(const change of edit.documentChanges||[]){const file=fileURLToPath(change.textDocument.uri);if(files.has(file))throw Error('Ambiguous duplicate LSP edits');if(change.textDocument.version!=null&&client.getOpenDocumentVersion(file)!==change.textDocument.version)return {applied:false,previewOnly:true,reason:'Unverified LSP document version',edit};files.set(file,change.edits)}
  const result=await applyLspTextEdits(ctx,files,exec,cwd,{requireObserved:true});if(result.applied)for(const file of files.keys())await client.openFile(file);return {...result,edit};
 },name,{signal:exec.signal});
}
