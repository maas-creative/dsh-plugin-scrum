// Independently authored adapter for the separately licensed Mason download metadata.
import {mkdir,chmod,stat} from 'node:fs/promises';
import {createReadStream,createWriteStream} from 'node:fs';
import {join,relative,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {extractLspArchive,archiveRelativePath} from './lsp-release-archives.mjs';
import {hashLspReleaseFile} from './lsp-github-release.mjs';
const allowedHosts=new Set(['releases.hashicorp.com','download.eclipse.org','projectlombok.org','download-cdn.jetbrains.com','download.jetbrains.com']);
function template(value,version){
 if(typeof value!=='string')throw Error('Invalid download template');
 const result=value.replace(/\{\{\s*version(?:\s*\|\s*strip_prefix\s+"([^"]*)")?\s*\}\}/g,(_match,prefix)=>prefix&&version.startsWith(prefix)?version.slice(prefix.length):version);
 if(/[{}]/.test(result))throw Error('Unsupported download template');return result;
}
export function selectGenericLspDownload(recipe,command,{platform=process.platform,arch=process.arch}={}){
 const source=/^pkg:generic\/([^@]+)@(.+)$/.exec(recipe?.source?.id||'');if(!source)throw Error('Invalid generic source');
 const system=platform==='win32'?'win':platform,architecture=arch==='ia32'?'x86':arch;
 const targets=[system+'_'+architecture,system,...(platform==='win32'?[]:['unix'])];let download;
 for(const target of targets){download=recipe.source.download?.find(row=>(Array.isArray(row.target)?row.target:[row.target]).includes(target));if(download)break;}
 if(!download||!download.files||typeof download.files!=='object')throw Error('No generic download for this platform');
 const files=Object.entries(download.files).map(([name,url])=>{const path=archiveRelativePath(name);if(path==='.'||path.includes('/'))throw Error('Invalid download filename');const parsed=new URL(template(url,source[2]));if(parsed.protocol!=='https:'||parsed.username||parsed.password||!allowedHosts.has(parsed.hostname))throw Error('Unapproved generic download origin');// JetBrains now signs CDN requests at its public download origin.
 if(source[1]==='Kotlin/kotlin-lsp'&&parsed.hostname==='download-cdn.jetbrains.com')parsed.hostname='download.jetbrains.com';
 return {name:path,url:parsed.href};});
 if(files.length===0||files.length>8)throw Error('Invalid download file count');
 let declared=recipe.bin?.[command];if(typeof declared!=='string')throw Error('Missing requested executable');
 let downloadBin=download.bin||'';
 // The pinned upstream Linux arm64 Kotlin row contains an extra opening brace.
 // Keep the licensed catalog unchanged and correct only that exact malformed declaration.
 if(source[1]==='Kotlin/kotlin-lsp'&&downloadBin==='kotlin-server-{{{ version | strip_prefix "kotlin-lsp/v" }}/bin/intellij-server')downloadBin=downloadBin.replace('{{{','{{');
 declared=declared.replaceAll('{{source.download.bin}}',template(downloadBin,source[2])).replace(/^python:/,'');
 const executable=archiveRelativePath(template(declared,source[2]));if(executable==='.')throw Error('Missing executable path');
 return {sourceId:recipe.source.id,files,executable};
}
async function download(url,path,{fetcher,signal,maxBytes}){
 let response;
 for(let redirects=0;;redirects++){
  const parsed=new URL(url);if(parsed.protocol!=='https:'||parsed.username||parsed.password||!allowedHosts.has(parsed.hostname))throw Error('Download redirect escaped approved origins');
  response=await fetcher(url,{signal,redirect:'manual'});
  if([301,302,303,307,308].includes(response.status)){await response.body?.cancel();if(redirects>=5)throw Error('Too many download redirects');const location=response.headers.get('location');if(!location)throw Error('Missing download redirect');url=new URL(location,url).href;continue;}break;
 }
 if(!response.ok||!response.body)throw Error('Generic download failed: '+response.status);
 const declared=response.headers.get('content-length');if(declared!=null&&(!/^\d+$/.test(declared)||Number(declared)>maxBytes))throw Error('Download exceeds size limit');
 const hash=createHash('sha256');let bytes=0;const meter=new Transform({transform(chunk,_encoding,done){bytes+=chunk.length;if(bytes>maxBytes)return done(Error('Download exceeds size limit'));hash.update(chunk);done(null,chunk);}});
 await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(path,{flags:'wx',mode:0o600}),{signal});if(declared!=null&&bytes!==Number(declared))throw Error('Download length mismatch');return {url,bytes,sha256:hash.digest('hex')};
}
export async function stageGenericLspRelease(recipe,settings,stage,context,{signal,fetcher=fetch,maxDownloadBytes=null,platform=process.platform,arch=process.arch}={}){
 // Official Kotlin standalone archives are 360 MB; keep the larger bound scoped
 // to this declared package rather than weakening every generic download.
 maxDownloadBytes??=recipe?.source?.id?.startsWith('pkg:generic/Kotlin/kotlin-lsp@')?512*1024*1024:256*1024*1024;
 if(!Number.isSafeInteger(maxDownloadBytes)||maxDownloadBytes<=0)throw Error('Invalid download limit');signal?.throwIfAborted();
 const spec=selectGenericLspDownload(recipe,settings.command[0],{platform,arch}),combined=signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000);
 const content=join(stage,'content');await mkdir(content,{mode:0o700});let archiveExtracted=false;const evidence=[];
 // Primary archive first; raw adjuncts (e.g. Lombok) cannot replace archive entries.
 const files=[...spec.files].sort((a,b)=>Number(/\.(zip|tar\.gz|tar\.xz|tar\.zst|tar)$/.test(b.name))-Number(/\.(zip|tar\.gz|tar\.xz|tar\.zst|tar)$/.test(a.name)));
 for(const [index,file] of files.entries()){
  const downloaded=join(stage,'download-'+index),receipt=await download(file.url,downloaded,{fetcher,signal:combined,maxBytes:maxDownloadBytes});
  if(/\.(zip|tar\.gz|tar\.xz|tar\.zst|tar)$/.test(file.name)){if(archiveExtracted)throw Error('Multiple generic archives are unsupported');await extractLspArchive(downloaded,content,{filename:file.name,signal:combined,context,maxBytes:spec.sourceId.startsWith('pkg:generic/Kotlin/kotlin-lsp@')?2*1024*1024*1024:1024*1024*1024});archiveExtracted=true;}
  else {const target=join(content,file.name);await pipeline(createReadStream(downloaded),createWriteStream(target,{flags:'wx',mode:0o600}),{signal:combined});}
  evidence.push({filename:file.name,...receipt});
 }
 const executable=resolve(content,spec.executable);if(!(await stat(executable)).isFile())throw Error('Declared generic executable absent');await chmod(executable,0o700);
 return {entry:relative(stage,executable),release:{sourceId:spec.sourceId,downloads:evidence,publishedDigestVerified:false},entrySha256:await hashLspReleaseFile(executable)};
}
