// Build only Scrum's independently authored native preferred sources.
import {readFile,writeFile,mkdir,mkdtemp,rename,rm,open,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,join} from 'node:path';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
if(process.platform!=='darwin'||!['arm64','x64'].includes(process.arch))throw Error('Native desktop helper build requires macOS arm64 or x64');
const root=resolve(process.argv[2]||fileURLToPath(new URL('./vendor/desktop-independent/',import.meta.url)));
await mkdir(root,{recursive:true});if(!(await lstat(root)).isDirectory())throw Error('Native build destination must be a real directory');
const compiler=execFileSync('/usr/bin/xcrun',['--find','swiftc'],{encoding:'utf8',timeout:10000}).trim();
const compilerVersion=execFileSync(compiler,['--version'],{encoding:'utf8',timeout:10000}).trim();
const sdk=execFileSync('/usr/bin/xcrun',['--sdk','macosx','--show-sdk-path'],{encoding:'utf8',timeout:10000}).trim();
const target=`${process.arch==='arm64'?'arm64':'x86_64'}-apple-macosx15.0`;
const preferred={};for(const [name,source]of Object.entries({stop:'desktop-native-stop.swift',observe:'desktop-observe.swift',guardian:'desktop-command-guardian.swift'}))preferred[name]=await readFile(new URL('./independent/'+source,import.meta.url));
const sourceSha256=Object.fromEntries(Object.entries(preferred).map(([name,bytes])=>[name,hash(bytes)]));
const buildKey=hash(JSON.stringify({sourceSha256,compilerVersion,sdk,target,flags:['-O']}));
const destination=join(root,buildKey),stage=await mkdtemp(join(root,'.stage-'));
async function durable(path,text){const handle=await open(path,'wx',0o600);try{await handle.writeFile(text);await handle.sync()}finally{await handle.close()}}
try{
 const binarySha256={};
 for(const [name,bytes]of Object.entries(preferred)){
  const source=join(stage,`${name}.swift`),binary=join(stage,`native-${name}`);await writeFile(source,bytes);
  execFileSync(compiler,['-O','-sdk',sdk,'-target',target,source,'-o',binary],{stdio:'inherit',timeout:120000});
  binarySha256[name]=hash(await readFile(binary));await rm(source);
 }
 const manifest={version:1,implementation:'Scrum independently authored native helpers',preferredSources:{stop:'independent/desktop-native-stop.swift',observe:'independent/desktop-observe.swift',guardian:'independent/desktop-command-guardian.swift'},sourceSha256,binarySha256,compilerVersion,sdk,target,buildKey};
 await durable(join(stage,'provenance.json'),JSON.stringify(manifest,null,2)+'\n');
 try{await rename(stage,destination)}catch(error){
  if(!['EEXIST','ENOTEMPTY'].includes(error.code))throw error;
  const previous=JSON.parse(await readFile(join(destination,'provenance.json'),'utf8'));
  if(previous.buildKey!==buildKey)throw Error('Existing native build identity mismatch');
  for(const name of Object.keys(preferred))if(hash(await readFile(join(destination,`native-${name}`)))!==previous.binarySha256[name])throw Error('Existing native build digest mismatch');
 }
 const pointer=join(root,`.current-${process.pid}-${Date.now()}.json`);await durable(pointer,JSON.stringify({version:1,buildKey,generation:buildKey},null,2)+'\n');await rename(pointer,join(root,'current.json'));
 console.log(JSON.stringify({buildKey,generation:destination,sourceSha256}));
}finally{await rm(stage,{recursive:true,force:true})}
