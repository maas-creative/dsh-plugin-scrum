import {executeGuardedLspEdit,parseEditLspRequestContext,runWithEditLspRequestContext} from './lsp-edit.mjs';
import {homedir} from 'node:os';
import {readdir,readFile,access} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import {dirname,join,extname,delimiter} from 'node:path';
import {agentPolicy} from './agent-role.mjs';
const flights=new Map(),notices=new Set();
// Marker precedence and defaults follow the pinned OMO formatter. Formatting is
// performed through stdin/stdout; only DSH may commit the resulting text.
export const formatterDefaults={mode:'best-effort',maxFileBytes:1048576,timeoutMs:3000};
async function binary(name,cwd){
 for(let directory=cwd;;directory=dirname(directory)){const path=join(directory,'node_modules','.bin',name);try{await access(path,constants.X_OK);return path}catch{}if(dirname(directory)===directory)break;}
 for(const directory of (process.env.PATH||'').split(delimiter)){const path=join(directory,name);try{await access(path,constants.X_OK);return path}catch{}}
 return null;
}
export async function formatterFor(path,cwd){
 const markers=await readdir(cwd),extension=extname(path);
 if(markers.some(m=>['biome.json','biome.jsonc'].includes(m)))return {name:'biome',args:['format','--stdin-file-path='+path]};
 if(markers.some(m=>m.startsWith('.prettierrc')||m.startsWith('prettier.config.')))return {name:'prettier',args:['--stdin-filepath',path]};
 if(markers.some(m=>['rustfmt.toml','Cargo.toml'].includes(m))&&extension==='.rs')return {name:'rustfmt',args:['--emit','stdout']};
 if(markers.includes('go.mod')&&extension==='.go')return {name:'gofmt',args:[]};
 if(extension==='.py'&&(markers.includes('ruff.toml')||markers.includes('pyproject.toml')&&/^\s*\[tool\.ruff\]/m.test(await readFile(join(cwd,'pyproject.toml'),'utf8'))))return {name:'ruff',args:['format','--stdin-filename',path,'-']};
 return null;
}
function run(command,args,text,{cwd,signal,timeoutMs,maxFileBytes}){
 return new Promise((resolve,reject)=>{
  const child=spawn(command,args,{cwd,stdio:['pipe','pipe','pipe'],detached:process.platform!=='win32'});let stdout=[],stderr=[],bytes=0,done=false;
  const kill=()=>{try{process.platform==='win32'?child.kill('SIGKILL'):process.kill(-child.pid,'SIGKILL')}catch{}};
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value)};
  const abort=()=>{kill();finish(Error('Formatting canceled'))},timer=setTimeout(()=>{kill();finish(Error('Formatter timed out'))},timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  child.on('error',error=>finish(error));child.stdin.on('error',()=>{});
  child.stdout.on('data',data=>{bytes+=data.length;if(bytes>maxFileBytes){kill();finish(Error('Formatter output exceeds size limit'))}else stdout.push(data)});
  child.stderr.on('data',data=>{if(Buffer.concat(stderr).length<65536)stderr.push(data)});
  child.on('close',code=>finish(code?Error('Formatter exited '+code+': '+Buffer.concat(stderr).toString('utf8')):null,Buffer.concat(stdout).toString('utf8')));child.stdin.end(text);
 });
}
export async function formatMutation(ctx,exec,result,config={}){
 const options={...formatterDefaults,...config};if(!['off','best-effort','required'].includes(options.mode)||!Number.isSafeInteger(options.maxFileBytes)||options.maxFileBytes<1||!Number.isInteger(options.timeoutMs)||options.timeoutMs<1)throw Error('Invalid formatter settings');
 if(result.isError||options.mode==='off'||agentPolicy(exec.agent).readOnly||!ctx.fs)return null;
 const name=exec.name.toLowerCase();if(!['write','edit','hashline_edit','apply_patch','ast_grep_rewrite','ast_grep_scan','lsp_rename'].includes(name))return null;
 const args=exec.arguments||{},cwd=exec.agent?.session?.header?.cwd||process.cwd(),root=await ctx.fs.resolve(cwd,{signal:exec.signal});
 const paths=new Set([args.file_path,args.filePath,args.path].filter(p=>typeof p==='string'));
 try{const value=JSON.parse((result.content||[]).filter(b=>b.type==='text').map(b=>b.text).join(''));if(value.applied===true)for(const path of value.files||value.application?.files||[])paths.add(path)}catch{}
 for(const match of String(args.patch||args.input||'').matchAll(/\*\*\* (?:Add|Update) File: (.+)/g))paths.add(match[1].trim());if(!paths.size)return null;
 const changes=[];
 for(const raw of paths){
  const target=await ctx.fs.resolve(raw,{cwd,signal:exec.signal});if(!ctx.fs.contains(root,target))throw Error('Formatter path outside workspace');
  const path=ctx.fs.processPath(target);if(!path)continue;const extension=extname(path),language=['.ts','.tsx'].includes(extension)?'typescript':extension==='.py'?'python':extension.slice(1);if(options.languages?.[language]===false)continue;
  try{execFileSync('git',['check-ignore','--quiet','--',path],{cwd,stdio:'ignore',timeout:1000});continue}catch{}
  const format=await formatterFor(path,cwd);if(!format)continue;
  const perform=async()=>{
   const info=await ctx.fs.stat(target,exec.signal);if(info?.type!=='file')return;const text=await ctx.fs.readText(target,exec.signal);if(Buffer.byteLength(text)>options.maxFileBytes)return;
   const controller=new AbortController(),abort=()=>controller.abort(exec.signal?.reason);exec.signal?.addEventListener('abort',abort,{once:true});if(exec.signal?.aborted)abort();
   const timer=setTimeout(()=>controller.abort(Error('LSP formatter timed out')),options.timeoutMs);
   try{
    const configRoot=join(process.env.DSH_HOME||join(homedir(),'.dsh'),'scrum');
    const context=parseEditLspRequestContext({cwd,projectConfigPaths:[join(cwd,'.scrum/lsp.json'),join(cwd,'.codex/lsp-client.json')],userConfigPath:join(configRoot,'lsp.json'),installDecisionsPath:join(configRoot,'lsp-decisions.json'),capabilities:{installDecisionTool:false}});
    const lsp=await runWithEditLspRequestContext(context,()=>executeGuardedLspEdit(ctx,'format',{filePath:path,expectedVersion:info.version},{...exec,signal:controller.signal},cwd));
    if(lsp.applied){if(lsp.files.length)changes.push('Auto-formatted '+raw+' with LSP. Reread before exact-text edits.');return;}
   }catch(error){if(exec.signal?.aborted)throw error;}
   finally{clearTimeout(timer);exec.signal?.removeEventListener('abort',abort);}
   // Recheck after the LSP attempt; a server or concurrent user may have changed the file.
   const current=await ctx.fs.stat(target,exec.signal);if(current?.version!==info.version)throw Error('Formatter input changed during LSP request');
   const executable=await binary(format.name,cwd);if(!executable){if(options.mode==='required')throw Error('Required formatter unavailable: '+format.name);const key=exec.agent?.session.id+':'+format.name;if(!notices.has(key)){notices.add(key);changes.push('Formatter unavailable: '+format.name)}return;}
   const output=await run(executable,format.args,text,{...options,cwd,signal:exec.signal});if(output===text)return;
   const policy=ctx.get('sandboxPolicy')?.resolve(exec.agent?{session:exec.agent.session}:{});
   const written=await ctx.fs.writeText(target,output,{kind:'replaceIfVersion',version:info.version},exec.signal,policy);ctx.emit('fs/observed',target,{kind:'present',version:written.version},exec);changes.push('Auto-formatted '+raw+' with '+format.name+'. Reread before exact-text edits.');
  };
  const prior=flights.get(path)||Promise.resolve(),work=prior.catch(()=>{}).then(perform);flights.set(path,work);try{await work}catch(error){if(options.mode==='required')throw error;changes.push('Formatting did not complete: '+error.message)}finally{if(flights.get(path)===work)flights.delete(path)}
 }
 return changes.join('\n')||null;
}
