import {mkdir,chmod,stat} from 'node:fs/promises';import {createReadStream,createWriteStream} from 'node:fs';
import {join,relative,resolve,posix} from 'node:path';import {createHash} from 'node:crypto';import {Readable,Transform} from 'node:stream';import {pipeline} from 'node:stream/promises';
import {extractLspArchive,archiveRelativePath} from './lsp-release-archives.mjs';
export function selectGithubLspAsset(recipe,command,{platform=process.platform,arch=process.arch,musl=platform==='linux'&&!process.report?.getReport()?.header?.glibcVersionRuntime}={}){
 const source=/^pkg:github\/([\w.-]+\/[\w.-]+)@(.+)$/.exec(recipe?.source?.id||'');if(!source)throw Error('Invalid GitHub LSP source');
 const system=platform==='win32'?'win':platform,architecture=arch==='ia32'?'x86':arch==='arm'?'armv7':arch;
 const targets=platform==='linux'?[`${system}_${architecture}_${musl?'musl':'gnu'}`,`${system}_${architecture}`,system,'unix']:[`${system}_${architecture}`,system,...(platform==='win32'?[]:['unix'])];
 const assets=recipe.source.asset;if(!Array.isArray(assets))throw Error('GitHub source has no release asset table');let asset;
 for(const target of targets){asset=assets.find(row=>(Array.isArray(row.target)?row.target:[row.target]).includes(target));if(asset)break;}if(!asset)throw Error('LSP release has no matching platform asset');
 const version=source[2],template=value=>String(value).replaceAll('{{version}}',version),spec=template(asset.file),separator=spec.indexOf(':');const filename=separator<0?spec:spec.slice(0,separator),prefix=separator<0?'':archiveRelativePath(spec.slice(separator+1));
 if(!filename||filename.includes('/')||filename.includes('\\')||filename.includes('\0'))throw Error('Invalid release asset filename');
 const declared=recipe.bin?.[command];if(typeof declared!=='string')throw Error('Recipe does not declare requested executable');
 const bin=template(declared.replace(/\{\{source\.asset\.bin(?:\.([\w.-]+))?\}\}/g,(_match,key)=>{const value=key?asset.bin?.[key]:asset.bin;if(typeof value!=='string')throw Error('Missing release executable declaration');return value;}).replaceAll('{{source.asset.file}}',filename)).replace(/^exec:/,'');
 const executable=archiveRelativePath(bin);if(executable==='.')throw Error('Release executable must name a file');return {repository:source[1],version,filename,prefix,executable};
}
export async function hashLspReleaseFile(file){const hash=createHash('sha256');for await(const chunk of createReadStream(file))hash.update(chunk);return hash.digest('hex');}
async function releaseMetadata(response){let size=0;const chunks=[];if(!response.body)throw Error('GitHub release metadata has no body');for await(const chunk of response.body){size+=chunk.length;if(size>2*1024*1024)throw Error('GitHub release metadata exceeds size limit');chunks.push(chunk);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function stageGithubLspRelease(recipe,settings,stage,context,{signal,fetcher=fetch,maxDownloadBytes=256*1024*1024,platform=process.platform,arch=process.arch}={}){
 if(!Number.isSafeInteger(maxDownloadBytes)||maxDownloadBytes<=0)throw Error('Invalid release download limit');signal?.throwIfAborted();const asset=selectGithubLspAsset(recipe,settings.command[0],{platform,arch}),combined=signal?AbortSignal.any([signal,AbortSignal.timeout(180000)]):AbortSignal.timeout(180000);
 const headers={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'Scrum-LSP-installer'};
 const response=await fetcher(`https://api.github.com/repos/${asset.repository}/releases/tags/${encodeURIComponent(asset.version)}`,{headers,signal:combined});if(!response.ok)throw Error('GitHub release lookup failed: '+response.status);
 const release=await releaseMetadata(response);if(release.tag_name!==asset.version||!Array.isArray(release.assets))throw Error('GitHub release identity did not match pinned source');const published=release.assets.find(row=>row.name===asset.filename);if(!published)throw Error('Pinned release asset unavailable: '+asset.filename);
 if(!Number.isSafeInteger(published.size)||published.size<=0||published.size>maxDownloadBytes)throw Error('Release download exceeds size limit');
 const url=new URL(published.browser_download_url);if(url.protocol!=='https:'||url.hostname!=='github.com'||!url.pathname.startsWith('/'+asset.repository+'/releases/download/'))throw Error('Unexpected release download identity');
 const downloaded=await fetcher(url.href,{signal:combined});if(!downloaded.ok||!downloaded.body)throw Error('GitHub asset download failed: '+downloaded.status);
 const archive=join(stage,'release-download'),hash=createHash('sha256');let size=0;const meter=new Transform({transform(chunk,_encoding,done){size+=chunk.length;if(size>maxDownloadBytes||size>published.size)return done(Error('Release asset exceeded declared size'));hash.update(chunk);done(null,chunk);}});
 await pipeline(Readable.fromWeb(downloaded.body),meter,createWriteStream(archive,{flags:'wx',mode:0o600}),{signal:combined});if(size!==published.size)throw Error('Release asset size did not match published metadata');const digest=hash.digest('hex');
 if(published.digest!=null&&(!/^sha256:[0-9a-f]{64}$/.test(published.digest)||published.digest!=='sha256:'+digest))throw Error('Release asset digest did not match GitHub metadata');
 const content=join(stage,'content');await mkdir(content,{mode:0o700});const destination=asset.prefix?join(content,asset.prefix):content;if(asset.prefix)await mkdir(destination,{recursive:true,mode:0o700});
 await extractLspArchive(archive,destination,{filename:asset.filename,rawName:posix.relative(asset.prefix||'.',asset.executable),signal:combined,context});
 const executable=resolve(content,asset.executable);if(!(await stat(executable)).isFile())throw Error('Release did not provide its declared executable');await chmod(executable,0o700);
 return {entry:relative(stage,executable),release:{repository:asset.repository,tag:asset.version,asset:asset.filename,sha256:digest,publishedDigestVerified:published.digest!=null},entrySha256:await hashLspReleaseFile(executable)};
}
