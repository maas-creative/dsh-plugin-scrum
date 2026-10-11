import {existsSync,readdirSync,readFileSync,realpathSync,statSync} from 'node:fs';
import {basename,dirname,extname,join,relative,resolve,isAbsolute} from 'node:path';import {homedir} from 'node:os';
import {parse,printParseErrorCode} from 'jsonc-parser';import {load,JSON_SCHEMA} from 'js-yaml';
const mappings={Read:'read',Glob:'glob',Grep:'grep',Bash:'bash',Edit:'edit',Write:'write',WebFetch:'fetch_content',WebSearch:'web_search'};
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value)}
function json(text){const errors=[],value=parse(text,errors,{allowTrailingComma:true});if(errors.length)throw Error(printParseErrorCode(errors[0].error));if(!object(value))throw Error('Agent definition must be an object');return value}
function data(path){const text=readFileSync(path,'utf8');if(extname(path)!=='.md')return json(text);const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);if(!match)return {prompt:text.trim()};const header=load(match[1],{schema:JSON_SCHEMA});if(!object(header))throw Error('Agent front matter must be an object');return {...header,prompt:match[2].trim()}}
function tools(value){let names;if(typeof value==='string')names=value.split(',');else if(Array.isArray(value)&&value.every(item=>typeof item==='string'))names=value;else if(object(value))names=Object.keys(value).filter(name=>value[name]===true);else return undefined;return [...new Set(names.map(name=>name.trim()).filter(Boolean).map(name=>mappings[name]??name))]}
function boundary(path,root){const rel=relative(root,path);return !isAbsolute(rel)&&rel!=='..'&&!rel.startsWith('..'+(process.platform==='win32'?'\\':'/'))}
export function loadAgentDefinitions({cwd=process.env.DSH_WORK_CWD||process.cwd(),home=homedir(),claude=process.env.CLAUDE_CONFIG_DIR||join(home,'.claude'),opencode=join(process.env.XDG_CONFIG_HOME||join(home,'.config'),'opencode'),paths=[],warn=()=>{}}={}){
 const result=Object.create(null),project=resolve(cwd);let projectBoundary;try{projectBoundary=realpathSync(project)}catch{projectBoundary=project}
 const add=(raw,key,scope,path)=>{
  if(!object(raw)||raw.disabled===true)return;
  const name=typeof raw.name==='string'?raw.name.trim():key;
  const instruction=raw.prompt??raw.instruction??raw.systemPrompt;
  if(!name||!instruction||typeof instruction!=='string'||['__proto__','constructor','prototype'].includes(name))return;
  const selected=tools(raw.tools);if(raw.tools!==undefined&&selected===undefined)return;
  result[name]={name,description:typeof raw.description==='string'?raw.description:name,instruction,scope,path,mode:typeof raw.mode==='string'?raw.mode:'subagent',...(typeof raw.model==='string'?{requestedModel:raw.model}:{}),model:'gpt-6.1-sol',reasoningEffort:'low',...(selected!==undefined?{tools:selected}:{}),readOnly:raw.readOnly===true||(selected!==undefined&&!selected.some(name=>['bash','write','edit'].includes(name)))};
 };
 const file=(path,scope,limit)=>{
  if(!existsSync(path))return;
  try{const canonical=realpathSync(path);if(limit&&!boundary(canonical,limit)){warn('Agent definition outside project: '+path);return}if(!statSync(canonical).isFile())return;add(data(canonical),basename(path,extname(path)),scope,path)}catch(error){warn('Cannot load agent definition '+path+': '+error.message)}
 };
 const directory=(path,scope,limit)=>{if(!existsSync(path))return;for(const entry of readdirSync(path).sort())if(/\.(md|json|jsonc)$/.test(entry))file(join(path,entry),scope,limit)};
 const config=(path,scope,limit)=>{
  if(!existsSync(path))return;
  try{const canonical=realpathSync(path);if(limit&&!boundary(canonical,limit)){warn('Agent config outside project: '+path);return}const value=json(readFileSync(canonical,'utf8'));for(const group of [value.agents,value.agent])if(object(group))for(const [name,definition] of Object.entries(group))add(definition,name,scope,canonical);if(Array.isArray(value.agent_definitions))for(const name of value.agent_definitions)if(typeof name==='string')file(resolve(dirname(canonical),name),scope,limit)}catch(error){warn('Cannot load agent config '+path+': '+error.message)}
 };
 directory(join(opencode,'agents'),'opencode');
 for(const ext of ['json','jsonc'])config(join(opencode,'opencode.'+ext),'opencode-config');
 directory(join(project,'.opencode','agents'),'opencode-project',projectBoundary);
 for(const folder of [project,join(project,'.opencode')])for(const ext of ['json','jsonc'])config(join(folder,'opencode.'+ext),'opencode-config',projectBoundary);
 directory(join(claude,'agents'),'user');directory(join(project,'.claude','agents'),'project',projectBoundary);
 for(const path of paths)if(typeof path==='string')file(resolve(project,path),'configured',projectBoundary);
 return result;
}
