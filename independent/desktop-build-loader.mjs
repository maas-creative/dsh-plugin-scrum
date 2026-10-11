import {readFile,lstat,open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const regular=async(path,maxBytes=128*1024)=>{const handle=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const stat=await handle.stat();if(!stat.isFile()||stat.size>maxBytes)throw Error('Invalid native desktop build file');return await handle.readFile()}finally{await handle.close()}};
export async function loadNativeDesktopBuild({root=fileURLToPath(new URL('../vendor/desktop-independent/',import.meta.url))}={}){
 const pointer=JSON.parse(await regular(join(root,'current.json')));
 if(pointer.version!==1||!/^[a-f0-9]{64}$/.test(pointer.generation)||pointer.generation!==pointer.buildKey)throw Error('Invalid native desktop generation');
 const generation=join(root,pointer.generation);if(!(await lstat(generation)).isDirectory())throw Error('Native desktop generation must be a real directory');
 const manifest=JSON.parse(await regular(join(generation,'provenance.json')));
 if(manifest.version!==1||manifest.buildKey!==pointer.buildKey)throw Error('Native desktop build identity mismatch');
 const target=`${process.arch==='x64'?'x86_64':process.arch}-apple-macosx15.0`;
 if(manifest.target!==target)throw Error('Native desktop build target differs from this host; rebuild helpers');
 const result={};
 for(const [name,source]of [['stop','desktop-native-stop.swift'],['observe','desktop-observe.swift'],['guardian','desktop-command-guardian.swift']]){
  if(sha(await readFile(new URL(source,import.meta.url)))!==manifest.sourceSha256?.[name])throw Error('Native desktop source changed; rebuild helpers');
  const path=join(generation,`native-${name}`);if(sha(await regular(path,128*1024*1024))!==manifest.binarySha256?.[name])throw Error('Native desktop helper digest mismatch');result[name]=path;
 }
 return result;
}
export function peekabooExecutable(){return join(dirname(createRequire(import.meta.url).resolve('@steipete/peekaboo/package.json')),'peekaboo')}
