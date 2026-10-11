import {existsSync,readFileSync} from 'node:fs';import {resolve,join,relative,isAbsolute,sep} from 'node:path';import {homedir} from 'node:os';import {builtinMcps} from '../builtin-mcps.mjs';
const defaultEnvironment=['HOME','PATH','USER','LOGNAME','SHELL','TMPDIR','TMP','TEMP','LANG','LC_ALL','LC_CTYPE','TERM','PWD','USERPROFILE','APPDATA','LOCALAPPDATA','XDG_CONFIG_HOME','XDG_DATA_HOME','XDG_CACHE_HOME'];
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
export function expandMcpEnvironment(value,{env=process.env,allowedEnvVars=[]}={}){
 const allowed=new Set([...defaultEnvironment,...allowedEnvVars.filter(name=>typeof name==='string')]);
 const expand=input=>{
  if(typeof input==='string')return input.replace(/\$\{([^}]+)\}/g,(_,body)=>{const index=body.indexOf(':-'),name=index<0?body:body.slice(0,index),fallback=index<0?'':body.slice(index+2);return allowed.has(name)&&env[name]!==undefined?String(env[name]):fallback});
  if(Array.isArray(input))return input.map(expand);
  if(object(input))return Object.fromEntries(Object.entries(input).map(([key,item])=>[key,expand(item)]));
  return input;
 };return expand(value);
}
function read(path){if(!existsSync(path))return {};let value;try{value=JSON.parse(readFileSync(path,'utf8'))}catch{throw Error('Invalid MCP configuration: '+path)}if(!object(value))throw Error('MCP configuration must be an object: '+path);return value}
function applies(server,cwd){if(server.scope!=='local'||typeof server.projectPath!=='string')return true;const rel=relative(resolve(server.projectPath),resolve(cwd));return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+sep)}
export function loadMcpConfiguration({directory=resolve(process.env.DSH_HOME||join(homedir(),'.dsh'),'scrum'),cwd=process.env.DSH_WORK_CWD||process.cwd(),homeDir=homedir(),claudeConfigDir=process.env.CLAUDE_CONFIG_DIR||join(homeDir,'.claude'),env=process.env,includeBuiltins=true}={}){
 const explicit=read(join(directory,'mcp.json')),sources=[];
 if(explicit.claudeCode?.enabled===true)for(const path of [join(homeDir,'.claude.json'),join(claudeConfigDir,'.mcp.json'),join(cwd,'.mcp.json'),join(cwd,'.claude','.mcp.json')])sources.push(read(path));
 const useBuiltins=includeBuiltins&&explicit.builtinMcps!==false&&!sources.some(source=>source.builtinMcps===false);
 const servers=useBuiltins?builtinMcps():{};
 const merge=(source,inherited)=>{
  if(!object(source.mcpServers))return;
  for(const [name,server] of Object.entries(source.mcpServers)){
   if(['__proto__','constructor','prototype'].includes(name))throw Error('Reserved MCP server name');
   if(!object(server))throw Error('Invalid MCP server configuration: '+name);
   if(inherited&&!applies(server,cwd))continue;
   if(inherited&&server.disabled===true){delete servers[name];continue}
   servers[name]={...servers[name],...server};
  }
 };
 for(const source of sources)merge(source,true);merge(explicit,false);
 return expandMcpEnvironment(servers,{env,allowedEnvVars:explicit.claudeCode?.allowedEnvVars??[]});
}
