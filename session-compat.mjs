import {fileURLToPath} from 'node:url';
import {installSandboxDirectoryCompatibility} from './sandbox-directories.mjs';
import {installGrepCompatibility} from './grep-compat.mjs';
import {installImageCompatibility} from './image-compat.mjs';
import {installWriteCompatibility} from './write-compat.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const marker='// Scrum external records are log-only; retain them without interpreting the native surface.';
const anchor='\t\tconst event = deepFreeze({\n\t\t\ttype,\n';
// DSH rc.2 accepts external records at append but fails to persist the compatibility
// marker needed to resume them. Keep unknown non-Scrum event rejection unchanged.
export async function installSessionCompatibility(){
 await installSandboxDirectoryCompatibility();
 await installGrepCompatibility();
 await installImageCompatibility();
 await installWriteCompatibility();
 const require=createRequire(import.meta.url),path=require.resolve('@deepseek-ai/dsh-session');
 const source=await readFile(path,'utf8');if(source.includes(marker))return {installed:false,path};
 if(source.split(anchor).length!==2)throw Error('Unsupported DSH Session.append implementation; review compatibility patch');
 const replacement='\t\t'+marker+'\n'+anchor+'\t\t\t...(!KNOWN_SESSION_EVENT_TYPES.has(type) && type.startsWith("scrum/") ? { ignorable: true } : {}),\n';
 await writeFile(path,source.replace(anchor,replacement));return {installed:true,path};
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1])await installSessionCompatibility();
