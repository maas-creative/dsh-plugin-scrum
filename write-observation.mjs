// Stat is an explicit overwrite observation, not permission to write. Native
// tool/sandbox checks and other write-intent policies still run unchanged.
export async function observeExplicitOverwrite(ctx,target,args,exec){
 let allowed=args.overwrite===true;
 if(!allowed){const cwd=exec.agent?.session.header.cwd||process.cwd(),root=await ctx.fs.resolve(cwd,{signal:exec.signal});allowed=ctx.fs.contains(root,target)&&/(^|[/\\])\.omo([/\\]|$)/.test(ctx.fs.processPath(target));}
 if(!allowed)return;const info=await ctx.fs.stat(target,exec.signal);
 if(info?.type==='file')ctx.emit('fs/observed',target,{kind:'present',version:info.version},exec);
}
