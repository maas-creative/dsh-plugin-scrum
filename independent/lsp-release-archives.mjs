// Independent archive adapter; extraction engines are separately licensed dependencies.
import {createReadStream,createWriteStream} from 'node:fs';
import {mkdir,lstat,readdir,realpath,chmod,rm,symlink} from 'node:fs/promises';
import {resolve,dirname,join,relative,isAbsolute,posix} from 'node:path';
import {pipeline} from 'node:stream/promises';import {Transform} from 'node:stream';import {createGunzip,createZstdDecompress} from 'node:zlib';
import {spawn} from 'node:child_process';import {once} from 'node:events';
import {list,extract} from 'tar';import yauzl from 'yauzl';
import {findLspExecutable} from './lsp-registry.mjs';
const within=(root,path)=>{const rel=relative(root,path);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('..\\');};
export function archiveRelativePath(value){
 if(typeof value!=='string'||value.includes('\0')||value.includes('\\')||/^([A-Za-z]:|\/)/.test(value))throw Error('Unsafe archive path');
 const path=posix.normalize(value.normalize('NFC'));if(path==='..'||path.startsWith('../'))throw Error('Archive path escaped extraction root');return path;
}
const limiter=max=>{let bytes=0;return new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;bytes>max?done(Error('Expanded archive exceeds size limit')):done(null,chunk);}});};
async function verifyTree(root,folder=root){for(const name of await readdir(folder)){const path=join(folder,name),info=await lstat(path);if(info.isSymbolicLink()){if(!within(root,await realpath(path)))throw Error('Extracted link escaped its package');}else if(info.isDirectory())await verifyTree(root,path);else if(!info.isFile())throw Error('Unsupported extracted file type');}}
async function decompress(file,target,kind,{maxBytes,signal,context}){
 if(kind==='xz'){
  const executable=await findLspExecutable('xz',context);if(!executable)throw Error('xz is required to unpack this release archive');
  const child=spawn(executable,['--decompress','--stdout',file],{stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'}),closed=once(child,'close');closed.catch(()=>{});let stderr='';child.stderr.on('data',chunk=>stderr=(stderr+chunk.toString()).slice(-8192));
  const kill=()=>{try{process.platform==='win32'?child.kill('SIGKILL'):process.kill(-child.pid,'SIGKILL')}catch{}};signal?.addEventListener('abort',kill,{once:true});
  try{await pipeline(child.stdout,limiter(maxBytes),createWriteStream(target,{flags:'wx',mode:0o600}),{signal});const [code]=await closed;if(code!==0)throw Error('xz decompression failed: '+stderr);}finally{signal?.removeEventListener('abort',kill);if(child.exitCode===null&&child.signalCode===null){kill();await closed.catch(()=>{});}}
 }else await pipeline(createReadStream(file),kind==='zstd'?createZstdDecompress():createGunzip(),limiter(maxBytes),createWriteStream(target,{flags:'wx',mode:0o600}),{signal});
}
export async function extractLspArchive(file,destination,{filename=String(file),rawName=null,maxBytes=1024*1024*1024,maxEntries=30000,signal,context={cwd:process.cwd()}}={}){
 if(!Number.isSafeInteger(maxBytes)||maxBytes<=0||!Number.isSafeInteger(maxEntries)||maxEntries<=0)throw Error('Invalid archive limits');signal?.throwIfAborted();try{await lstat(destination);}catch(error){if(error.code!=='ENOENT')throw error;if(!(await lstat(dirname(destination))).isDirectory())throw Error('Extraction parent must be an owned directory');await mkdir(destination,{mode:0o700});}const root=await realpath(destination);if((await lstat(destination)).isSymbolicLink()||(await readdir(root)).length)throw Error('Extraction destination must be an empty owned directory');
 if(filename.endsWith('.zip')){
  const zip=await yauzl.openPromise(file,{lazyEntries:true,strictFileNames:true,validateEntrySizes:true});let total=0,count=0;const names=new Set(),links=[];
  try{for await(const entry of zip.eachEntry()){
   signal?.throwIfAborted();const name=archiveRelativePath(entry.fileName),path=resolve(root,name);if(!Number.isSafeInteger(entry.uncompressedSize)||entry.uncompressedSize<0||++count>maxEntries||(total+=entry.uncompressedSize)>maxBytes)throw Error('Zip archive exceeds extraction limits');
   const mode=entry.externalFileAttributes>>>16,type=mode&0o170000,isDirectory=entry.fileName.endsWith('/');if(name==='.'&&isDirectory)continue;if(names.has(name)&&!isDirectory)throw Error('Duplicate archive entry');names.add(name);
   if(isDirectory){await mkdir(path,{recursive:true,mode:0o700});continue;}if(type&&![0o100000,0o120000].includes(type))throw Error('Unsupported zip file type');
   await mkdir(dirname(path),{recursive:true,mode:0o700});const stream=await zip.openReadStreamPromise(entry);
   if(type===0o120000){let content=Buffer.alloc(0);for await(const chunk of stream){content=Buffer.concat([content,chunk]);if(content.length>8192)throw Error('Archive link exceeds size limit');}const target=content.toString('utf8');if(target.includes('\0')||target.includes('\\')||isAbsolute(target)||/^[A-Za-z]:/.test(target)||!within(root,resolve(dirname(path),target)))throw Error('Archive link escaped extraction root');links.push({path,target});}
   else await pipeline(stream,limiter(Math.min(maxBytes,entry.uncompressedSize)),createWriteStream(path,{flags:'wx',mode:mode&0o111?0o700:0o600}),{signal});
  }for(const link of links)await symlink(link.target,link.path);
  }finally{zip.close();}
 }else if(/\.tar(?:\.gz|\.xz|\.zst)?$/.test(filename)){
  let tarFile=file,temporary=null;const manifest=[];let total=0,failure=null;
  try{if(!filename.endsWith('.tar')){temporary=join(dirname(file),'.expanded-'+Date.now()+'-'+Math.random().toString(16).slice(2)+'.tar');await decompress(file,temporary,filename.endsWith('.xz')?'xz':filename.endsWith('.zst')?'zstd':'gzip',{maxBytes,signal,context});tarFile=temporary;}
   await list({file:tarFile,strict:true,onReadEntry:entry=>{try{signal?.throwIfAborted();const name=archiveRelativePath(entry.path);if(!Number.isSafeInteger(entry.size)||entry.size<0||manifest.length>=maxEntries||(total+=entry.size)>maxBytes)throw Error('Tar archive exceeds extraction limits');if(!['File','OldFile','Directory','SymbolicLink','Link'].includes(entry.type))throw Error('Unsupported tar file type');if(['SymbolicLink','Link'].includes(entry.type)){const link=entry.linkpath;if(typeof link!=='string'||link.includes('\0')||link.includes('\\')||isAbsolute(link)||/^[A-Za-z]:/.test(link)||!within(root,resolve(entry.type==='Link'?root:dirname(resolve(root,name)),link)))throw Error('Archive link escaped extraction root');}manifest.push({name,mode:entry.mode,type:entry.type});}catch(error){failure||=error;}}});if(failure)throw failure;signal?.throwIfAborted();
   await extract({file:tarFile,cwd:root,strict:true,preservePaths:false,preserveOwner:false,filter:()=>!signal?.aborted});signal?.throwIfAborted();
   for(const item of manifest)if(['File','OldFile'].includes(item.type))await chmod(resolve(root,item.name),item.mode&0o111?0o700:0o600);
  }finally{if(temporary)await rm(temporary,{force:true});}
 }else{
  if(!rawName)throw Error('Raw release executable has no declared filename');const target=resolve(root,archiveRelativePath(rawName));await mkdir(dirname(target),{recursive:true,mode:0o700});
  if(filename.endsWith('.gz')||filename.endsWith('.xz'))await decompress(file,target,filename.endsWith('.xz')?'xz':'gzip',{maxBytes,signal,context});
  else await pipeline(createReadStream(file),limiter(maxBytes),createWriteStream(target,{flags:'wx',mode:0o700}),{signal});await chmod(target,0o700);
 }
 await verifyTree(root);return root;
}
