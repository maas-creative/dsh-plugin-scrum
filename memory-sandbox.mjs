import {LocalSandboxProvider} from '@deepseek-ai/dsh-sandbox-local';
import {canonicalPath} from '@deepseek-ai/dsh-sandbox';
import {dirname,basename} from 'node:path';
import {memoryLocation} from './memory.mjs';
const literal=path=>'"'+path.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
export function memorySeatbeltFence(directory){const own=canonicalPath(directory),area=canonicalPath(dirname(own));return ['file-read*','file-write*'].map(operation=>'(deny '+operation+' (require-all (subpath '+literal(area)+') (require-not (subpath '+literal(own)+'))))').join(' ')}
// Keep native confinement and add the memory read boundary, using public provider override.
export default class ScrumMemorySandbox extends LocalSandboxProvider {
 static inject=LocalSandboxProvider.inject;
 static Config=LocalSandboxProvider.Config;
 async confine(argv,policy,signal){const confined=await super.confine(argv,policy,signal);if(process.platform!=='darwin')throw Error('Scrum cross-project memory process policy requires a platform adapter');const profile=confined.argv.indexOf('-p');if(profile<0||basename(confined.argv[0])!=='sandbox-exec')throw Error('Scrum memory fence requires native Seatbelt confinement');const own=memoryLocation({cwd:policy.workspaceRoot}).directory;const output=[...confined.argv];output[profile+1]+=' '+memorySeatbeltFence(own);return {...confined,argv:output}}
}
