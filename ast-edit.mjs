// Apply ast-grep previews through the host filesystem's versioned write API.
export async function applyAstPreview(ctx,preview,exec,cwd){
 if(!preview.ok||preview.truncation?.truncated)throw Error('A complete successful AST preview is required');
 const grouped=new Map();for(const match of preview.matches||[]){if(!grouped.has(match.path))grouped.set(match.path,[]);grouped.get(match.path).push(match)}
 const pending=[];
 for(const [path,matches] of grouped){
  const target=await ctx.fs.resolve(path,{cwd,signal:exec.signal});
  const root=await ctx.fs.resolve(cwd,{signal:exec.signal});if(!ctx.fs.contains(root,target))throw Error('AST target is outside the working directory');
  const info=await ctx.fs.stat(target,exec.signal);if(info?.type!=='file')throw Error('AST target must be a file');
  const bytes=Buffer.from(await ctx.fs.readText(target,exec.signal));let end=bytes.length;const parts=[];
  for(const match of matches.sort((a,b)=>b.range.start.byteOffset-a.range.start.byteOffset)){
   const start=match.range.start.byteOffset,stop=match.range.end.byteOffset;
   if(!Number.isInteger(start)||start<0||stop<start||stop>end||bytes.subarray(start,stop).toString()!==match.text)throw Error('AST preview is stale or overlapping; rerun the search');
   parts.unshift(Buffer.from(match.replacement),bytes.subarray(stop,end));end=start;
  }
  parts.unshift(bytes.subarray(0,end));const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(parts));
  const intent=await ctx.waterfall('fs/edit-intent',target,exec,()=>undefined);
  if(intent?.version&&intent.version!==info.version)throw Error('AST target changed since the last observation');
  pending.push({target,text,version:info.version});
 }
 const changed=[];try{for(const item of pending){const policy=ctx.get('sandboxPolicy')?.resolve(exec.agent?{session:exec.agent.session}:{});const result=await ctx.fs.writeText(item.target,item.text,{kind:'replaceIfVersion',version:item.version},exec.signal,policy);ctx.emit('fs/observed',item.target,{kind:'present',version:result.version},exec);changed.push(item.target.displayPath)}}catch(error){throw Error(`AST write failed; already changed: ${JSON.stringify(changed)}. ${error.message}`)}
 return {...preview,applied:true,application:{requested:true,performed:true,versionChecked:true,files:changed}};
}
