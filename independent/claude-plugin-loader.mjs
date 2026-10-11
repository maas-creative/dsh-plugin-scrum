// Scrum implementation of installed Claude plugin discovery and hook loading.
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import {resolve,join,relative,isAbsolute} from 'node:path';
import {homedir} from 'node:os';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function readJson(path,optional=false){try{return JSON.parse(readFileSync(path,'utf8'))}catch(error){if(optional&&error.code==='ENOENT')return null;throw error}}
function canonical(path){try{return realpathSync(path)}catch{return resolve(path)}}
function hookFile(root,path){if(typeof path!=='string')throw Error('Hook file must be a path');const target=resolve(root,path),rel=relative(canonical(root),canonical(target));if(rel==='..'||rel.startsWith('../')||isAbsolute(rel))throw Error('Hook file escapes plugin directory');return target}
export function discoverInstalledPlugins({pluginsHomeOverride=join(homedir(),'.claude','plugins'),cwdOverride=process.cwd(),enabledPluginsOverride={}}={}){
 const plugins=[],errors=[];let registry;
 try{registry=readJson(join(pluginsHomeOverride,'installed_plugins.json'),true);if(registry===null)return{plugins,errors};if(!object(registry.plugins))throw Error('Installed plugin registry requires a plugin map')}catch(error){return{plugins,errors:[{pluginKey:'registry',error:error.message}]}}
 for(const [pluginKey,records] of Object.entries(registry.plugins)){
  if(enabledPluginsOverride[pluginKey]===false)continue;
  try{
   const entries=Array.isArray(records)?records:registry.version===1&&object(records)?[{scope:'user',...records}]:null;
   if(!entries)throw Error('Plugin installations must be a list');
   for(const entry of entries){
    if(!object(entry))throw Error('Invalid plugin installation');
    if(['project','local'].includes(entry.scope)&&(!entry.projectPath||canonical(entry.projectPath)!==canonical(cwdOverride)))continue;
    if(!['user','project','local','managed'].includes(entry.scope))throw Error('Unknown plugin installation scope');
    if(typeof entry.installPath!=='string'||!isAbsolute(entry.installPath)||!existsSync(entry.installPath))throw Error('Plugin installation directory is unavailable');
    const installPath=canonical(entry.installPath),manifest=readJson(join(installPath,'.claude-plugin','plugin.json'),true);
    if(manifest!==null&&!object(manifest))throw Error('Plugin manifest must be an object');
    plugins.push({name:manifest?.name||pluginKey.split('@')[0],version:entry.version,scope:entry.scope,installPath,pluginKey,hooksPath:join(installPath,'hooks','hooks.json'),hookDeclarations:manifest?.hooks});
    break;
   }
  }catch(error){errors.push({pluginKey,error:error.message})}
 }
 return{plugins,errors};
}
function project(value,root){if(typeof value==='string')return value.replaceAll('${CLAUDE_PLUGIN_ROOT}',root);if(Array.isArray(value))return value.map(item=>project(item,root));if(object(value))return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,project(item,root)]));return value}
export function loadPluginHooksConfigs(plugins){
 const loaded=[];
 for(const plugin of plugins){
  const root=plugin.installPath,seen=new Set(),configs=[];
  const add=declaration=>{
   if(typeof declaration==='string'){const path=hookFile(root,declaration),identity=canonical(path);if(seen.has(identity))return;seen.add(identity);configs.push(readJson(path));}
   else if(object(declaration))configs.push(declaration);
   else throw Error('Plugin hook declaration must be a path or object');
  };
  const standard=plugin.hooksPath||join(root,'hooks','hooks.json');if(existsSync(standard))add(standard);
  if(plugin.hookDeclarations!==undefined)for(const declaration of Array.isArray(plugin.hookDeclarations)?plugin.hookDeclarations:[plugin.hookDeclarations])add(declaration);
  for(const config of configs){if(!object(config)||!object(config.hooks))throw Error('Plugin hook configuration requires a hooks map');const hooks={};for(const[event,matchers]of Object.entries(config.hooks)){if(!Array.isArray(matchers))throw Error('Plugin hook matchers must be a list');hooks[event]=matchers.map(matcher=>{if(!object(matcher)||!Array.isArray(matcher.hooks))throw Error('Invalid plugin hook matcher');return{...project(matcher,root),hooks:matcher.hooks.map(hook=>{if(!object(hook))throw Error('Invalid plugin hook');return{...project(hook,root),pluginRoot:root}})}})}loaded.push({hooks})}
 }
 return loaded;
}
