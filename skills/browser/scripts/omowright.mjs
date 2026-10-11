import {statSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {guardOmowright} from './browser-engine-guard.mjs';
export {BROWSER_CONFIRMATION_POLICY,BROWSER_ENGINE_ENV,BROWSER_STATE_EVENT,BrowserActionDeclinedError,BrowserEngineRefusal,BrowserNotConnectedError,BrowserUserStoppedError,guardOmowright} from './browser-engine-guard.mjs';
const bundled=fileURLToPath(new URL('../runtime/omowright/index.js',import.meta.url));
function isFile(path){try{return statSync(path).isFile()}catch{return false}}
export function resolveOmowrightEntry(env=process.env) {
 const candidates=[];
 if(typeof env.OMOWRIGHT_ROOT==='string'&&env.OMOWRIGHT_ROOT)candidates.push(join(env.OMOWRIGHT_ROOT,'index.js'));
 candidates.push(bundled);
 try{candidates.push(createRequire(import.meta.url).resolve('omowright'))}catch{}
 return candidates.find(isFile);
}
function kernelHost() {
 const tools=globalThis.tool;
 if(!tools||typeof globalThis.tool_schema!=='function')return undefined;
 return {
  listTools:async()=>{const schema=await globalThis.tool_schema();return Array.isArray(schema)?schema.map(row=>typeof row==='string'?row:row.name):Object.keys(tools)},
  callTool:async(name,args)=>{
   if(typeof tools[name]!=='function')throw Error('Browser host tool unavailable: '+name);
   return tools[name](args);
  },
 };
}
export async function loadOmowright(env=process.env,host) {
 const entry=resolveOmowrightEntry(env);
 if(!entry)throw Error('OmOWright runtime unavailable; rebuild the shipped browser runtime or configure OMOWRIGHT_ROOT');
 const runtime=await import(pathToFileURL(entry).href);
 return {entry,omowright:guardOmowright(runtime,{env,host:host??kernelHost()})};
}
