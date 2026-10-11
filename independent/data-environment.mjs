import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,mkdtempSync,writeFileSync,rmSync,statSync,accessSync,constants} from 'node:fs';
import {join,resolve,dirname,delimiter} from 'node:path';
import {homedir,tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {pathToFileURL} from 'node:url';
const execute=(command,args,options={})=>execFileSync(command,args,{encoding:'utf8',timeout:120000,maxBuffer:1024*1024,...options});
const defaults=options=>({env:process.env,run:execute,platform:process.platform,...options});
export function findExecutable(name,{env=process.env,platform=process.platform}={}){
 const extensions=platform==='win32'?['.exe','.cmd','.bat','']:[''];
 const usable=file=>{try{if(!statSync(file).isFile())return false;if(platform!=='win32')accessSync(file,constants.X_OK);return true;}catch{return false;}};
 if(name.includes('/')||name.includes('\\'))return usable(name)?resolve(name):null;
 for(const root of (env.PATH||'').split(platform==='win32'?';':delimiter).filter(Boolean))for(const extension of extensions){const file=join(root,name+extension);if(usable(file))return resolve(file);}
 return null;
}
function cacheRoot(env){return resolve(env.SCRUM_DATA_SCIENTIST_CACHE_ROOT||join(env.HOME||env.USERPROFILE||homedir(),'.cache','omo-data-scientist'));}
function locked(root,fn){mkdirSync(root,{recursive:true});const db=new DatabaseSync(join(root,'.scrum-install.sqlite'));try{db.exec('PRAGMA busy_timeout=120000;BEGIN IMMEDIATE');const value=fn();db.exec('COMMIT');return value;}catch(error){try{db.exec('ROLLBACK')}catch{}throw error;}finally{db.close();}}
function uvExecutable(options){const {env,platform}=options;return findExecutable('uv',options)||[env.UV_INSTALL_DIR,join(env.HOME||env.USERPROFILE||homedir(),'.local','bin'),join(env.HOME||env.USERPROFILE||homedir(),'.cargo','bin')].filter(Boolean).map(root=>join(root,platform==='win32'?'uv.exe':'uv')).find(existsSync);}
export function ensurePythonDependencies(python='python3',options={}){
 const config=defaults(options),{run,env}=config;const executable=findExecutable(python,config);if(!executable)throw Error('Python executable not found: '+python);
 const tag=run(executable,['-c','import sys; print("cp"+str(sys.version_info.major)+str(sys.version_info.minor))'],{env}).trim();if(!/^cp\d{2,6}$/.test(tag))throw Error('Python returned an invalid version tag');
 const root=cacheRoot(env),target=join(root,'py-'+tag),childEnv={...env,PYTHONPATH:target+(env.PYTHONPATH?delimiter+env.PYTHONPATH:'')};
 const check=()=>{if(!existsSync(join(target,'polars'))||!existsSync(join(target,'pyarrow')))return false;try{run(executable,['-c','import os,sys,polars,pyarrow; root=os.path.realpath(sys.argv[1]); assert all(os.path.commonpath([root,os.path.realpath(m.__file__)])==root for m in (polars,pyarrow))',target],{env:childEnv});return true;}catch{return false;}};
 return locked(root,()=>{if(!check()){const uv=uvExecutable(config);if(!uv)throw Error('uv is required to prepare Python dependencies');mkdirSync(target,{recursive:true});run(uv,['pip','install','--python',executable,'--target',target,'polars','pyarrow'],{env});if(!check())throw Error('Python dependency installation did not produce importable cached modules');}return target;});
}
export function ensureJavaScriptDependencies(options={}){
 const config=defaults(options),{run,env}=config,root=cacheRoot(env),file=join(root,'node_modules','@duckdb','node-api','lib','index.js');
 const check=()=>{if(!existsSync(file))return false;try{run(process.execPath,['--input-type=module','-e','const module=await import(process.argv[1]);if(typeof module.DuckDBInstance!=="function")throw Error("Missing DuckDBInstance");',pathToFileURL(file).href],{env});return true;}catch{return false;}};
 return locked(root,()=>{if(!check()){const bun=findExecutable('bun',config),npm=findExecutable('npm',config);if(!bun&&!npm)throw Error('Bun or npm is required to prepare JavaScript dependencies');if(!existsSync(join(root,'package.json')))writeFileSync(join(root,'package.json'),JSON.stringify({private:true}));if(bun)run(bun,['add','@duckdb/node-api'],{cwd:root,env});else if(config.platform==='win32'&&/\.(cmd|bat)$/i.test(npm)){const cli=join(dirname(npm),'node_modules','npm','bin','npm-cli.js');if(!existsSync(cli))throw Error('Windows npm launcher has no adjacent npm CLI; use Bun or a complete Node installation');run(process.execPath,[cli,'install','--no-audit','--no-fund','@duckdb/node-api'],{cwd:root,env});}else run(npm,['install','--no-audit','--no-fund','@duckdb/node-api'],{cwd:root,env});if(!check())throw Error('JavaScript dependency installation did not produce a loadable DuckDB module');}return file;});
}
export async function setupUv(options={}){
 const config=defaults(options),{env,run,platform}=config,childEnv={...env,UV_NO_MODIFY_PATH:'1'};let executable=uvExecutable(config);
 if(executable){try{run(executable,['self','update'],{env:childEnv});return {executable,version:run(executable,['--version'],{env:childEnv}).trim()};}catch{/* Package-managed versions may not self-update; use official standalone installer. */}}
 const windows=platform==='win32',url='https://astral.sh/uv/install.'+(windows?'ps1':'sh');const response=await (options.fetch||fetch)(url,{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Official uv installer download failed: '+response.status);
 const chunks=[];let bytes=0;for await(const chunk of response.body){bytes+=chunk.length;if(bytes>1024*1024)throw Error('uv installer exceeds size limit');chunks.push(chunk);}
 const directory=mkdtempSync(join(tmpdir(),'scrum-uv-')),script=join(directory,windows?'install.ps1':'install.sh');
 try{writeFileSync(script,Buffer.concat(chunks),{mode:0o600});if(windows)run('powershell.exe',['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',script],{env:childEnv});else run('/bin/sh',[script],{env:childEnv});
  const home=env.HOME||env.USERPROFILE||homedir(),installed=[env.UV_INSTALL_DIR,join(home,'.local','bin'),join(home,'.cargo','bin')].filter(Boolean).map(root=>join(root,windows?'uv.exe':'uv')).find(existsSync);executable=installed||uvExecutable(config);if(!executable)throw Error('uv installer completed without a discoverable executable');return {executable,version:run(executable,['--version'],{env:childEnv}).trim()};
 }finally{rmSync(directory,{recursive:true,force:true});}
}
