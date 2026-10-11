import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const platform=process.platform+'-'+process.arch;
const binary=fileURLToPath(new URL('../vendor/comment-checker/'+(platform==='darwin-arm64'?'comment-checker':platform+'/comment-checker'+(process.platform==='win32'?'.exe':'')),import.meta.url));
const clean=()=>({hasComments:false,message:''});
export async function checkComments(input,{binaryPath=binary,timeoutMs=30000,signal,customPrompt}={}){
 if(signal?.aborted)return {...clean(),incomplete:'canceled'};
 let body;try{body=JSON.stringify(input)}catch{return {...clean(),incomplete:'Invalid comment checker input'}}
 if(typeof body!=='string'||Buffer.byteLength(body)>1024*1024)return {...clean(),incomplete:'Comment checker input exceeds 1 MiB'};
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>2147483647)return {...clean(),incomplete:'Invalid comment checker timeout'};
 if(!existsSync(binaryPath))return {...clean(),incomplete:'Comment checker binary unavailable'};
 return new Promise(resolve=>{
  let child,timer,stderr='',bytes=0,reason,ended=false,inputFailed=false;
  const stop=why=>{reason ||= why;child?.kill('SIGKILL')};
  const abort=()=>stop('canceled');
  const finish=code=>{if(ended)return;ended=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);
   if(reason)return resolve({...clean(),incomplete:reason});
   if(inputFailed)return resolve(clean());
   if(code===2)return resolve({hasComments:true,message:stderr.trim()});
   if(code===0)return resolve(clean());
   resolve({...clean(),failure:{exitCode:code??-1,stderr:stderr.trim()}});
  };
  try{child=spawn(binaryPath,typeof customPrompt==='string'&&customPrompt?['--prompt',customPrompt]:[],{cwd:input?.cwd,stdio:['pipe','pipe','pipe']})}catch{return resolve({...clean(),incomplete:'Comment checker process could not start'})}
  child.once('error',()=>{reason ||= 'Comment checker process could not start';finish(-1)});
  child.once('close',finish);
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>1024*1024)stop('Comment checker output exceeds 1 MiB')});
  child.stderr.setEncoding('utf8');
  child.stderr.on('data',chunk=>{bytes+=Buffer.byteLength(chunk);if(bytes>1024*1024)stop('Comment checker output exceeds 1 MiB');else stderr+=chunk});
  child.stdin.on('error',()=>{inputFailed=true});
  signal?.addEventListener('abort',abort,{once:true});
  timer=setTimeout(()=>stop('timed out'),timeoutMs);
  if(signal?.aborted)abort();
  child.stdin.end(body);
 });
}
const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function extractApplyPatchEdits(metadata,args={}){
 const edits=[];
 if(record(metadata)&&Array.isArray(metadata.files))for(const row of metadata.files){
  if(!record(row)||row.type==='delete')continue;
  const filePath=row.filePath??row.file_path??row.path;
  if(typeof filePath==='string'&&typeof row.before==='string'&&typeof row.after==='string')edits.push({filePath,before:row.before,after:row.after});
 }
 if(edits.length)return edits;
 const patch=record(args)?args.patch??args.patchText??args.input:undefined;
 if(typeof patch!=='string'||Buffer.byteLength(patch)>1024*1024)return [];
 let current;
 const flush=()=>{if(current){if(current.before.length||current.after.length)edits.push({filePath:current.path,before:current.before.join('\n')+(current.before.length?'\n':''),after:current.after.join('\n')+(current.after.length?'\n':'')});current=undefined}};
 for(const line of patch.split(/\r?\n/)){
  if(line.startsWith('*** ')){
   if(line.startsWith('*** Add File: ')||line.startsWith('*** Update File: ')){flush();const path=line.slice(line.indexOf(': ')+2);if(path)current={path,before:[],after:[]};}
   else if(line.startsWith('*** Delete File: ')||line==='*** End Patch')flush();
   else if(line.startsWith('*** Move to: ')&&current)current.path=line.slice(13);
   continue;
  }
  if(!current)continue;
  if(line.startsWith('+'))current.after.push(line.slice(1));
  else if(line.startsWith('-'))current.before.push(line.slice(1));
 }
 flush();return edits;
}
