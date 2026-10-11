import {realpath,lstat,readdir} from 'node:fs/promises';
import {resolve,relative,isAbsolute,join} from 'node:path';
import {configuration,availableLspCommand,parseLspRequestContext,runWithRequestContext,withLspClient,getLspManager} from './lsp-client.mjs';
import {lspFileExtension,lspInstallRecipe} from './lsp-registry.mjs';
const inside=(root,path)=>{const rel=relative(root,path);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('../')&&!rel.startsWith('..\\');};
export async function detectProjectLsp({cwd,files,limit=10000,userConfigPath,projectConfigPaths=[]}){
 const root=await realpath(resolve(cwd));if(!Number.isSafeInteger(limit)||limit<1||limit>100000)throw Error('Invalid LSP scan limit');const context=parseLspRequestContext({cwd:root,userConfigPath,projectConfigPaths,capabilities:{}}),extensions=new Set();let scanned=0,truncated=false;
 const observe=async path=>{const info=await lstat(path);if(info.isSymbolicLink())return;if(info.isFile()){if(++scanned>limit){truncated=true;return}extensions.add(lspFileExtension(path));}};
 if(files){for(const file of files){const path=resolve(root,file);if(!inside(root,path))throw Error('LSP detection file outside workspace');await observe(path);}}
 else{const pending=[root];while(pending.length&&!truncated){const dir=pending.pop();for(const entry of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const path=join(dir,entry.name);if(entry.isSymbolicLink())continue;if(entry.isDirectory()){if(!['.git','node_modules','.venv','vendor','dist','build'].includes(entry.name))pending.push(path);}else if(entry.isFile())await observe(path);if(truncated)break;}}}
 const servers=await configuration(context),matches=[];for(const [id,settings]of Object.entries(servers)){const matched=(settings.extensions||[]).filter(extension=>extensions.has(extension));if(settings.disabled||!matched.length)continue;const command=await availableLspCommand(id,settings,context);matches.push({id,extensions:matched,available:!!command,command,recipe:settings.recipe?lspInstallRecipe(settings.recipe)?.source.id:null});}
 return {cwd:root,scanned:Math.min(scanned,limit),truncated,extensions:[...extensions].sort(),servers:matches.sort((a,b)=>a.id.localeCompare(b.id))};
}
export async function verifyProjectLsp({cwd,file,userConfigPath,projectConfigPaths=[],signal}){
 if(typeof file!=='string'||!file)throw Error('LSP verification requires a source file');const root=await realpath(resolve(cwd)),context=parseLspRequestContext({cwd:root,userConfigPath,projectConfigPaths,capabilities:{}});
 try{return await runWithRequestContext(context,()=>withLspClient(file,async(client,_root,path)=>{const uri=await client.openFile(path,signal);return {verified:true,serverId:client.id,file:path,capabilities:client.capabilities,symbols:client.capabilities.documentSymbolProvider?await client.sendRequest('textDocument/documentSymbol',{textDocument:{uri}},{signal}):null};},'setup-verification',{signal}));}finally{await getLspManager().stopAll();}
}
