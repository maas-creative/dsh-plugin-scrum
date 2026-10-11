import {existsSync,readdirSync,readFileSync,realpathSync,statSync} from 'node:fs';import {join,relative,resolve,sep,isAbsolute} from 'node:path';import {homedir} from 'node:os';import {load,JSON_SCHEMA} from 'js-yaml';import {loadScrumConfiguration,configurationAllows} from '../configuration.mjs';
function within(root,path){const part=relative(root,path);return !isAbsolute(part)&&part!=='..'&&!part.startsWith('..'+sep)}
function parse(text){const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(text);if(!match)return {metadata:{},body:text.trim()};const value=load(match[1],{schema:JSON_SCHEMA});if(value!==null&&(typeof value!=='object'||Array.isArray(value)))throw Error('Command front matter must be an object');return {metadata:value??{},body:match[2].trim()}}
export function loadCommandTemplates({cwd=process.env.DSH_WORK_CWD||process.cwd(),home=homedir(),claude=process.env.CLAUDE_CONFIG_DIR||join(home,'.claude'),opencode=join(process.env.XDG_CONFIG_HOME||join(home,'.config'),'opencode'),warn=()=>{}}={}){
 const config=loadScrumConfiguration({cwd,env:{...process.env,HOME:home}}).config,commands=[],names=new Set();
 const sources=[[join(cwd,'.scrum','commands'),'scrum'],[join(claude,'commands'),'user'],[join(cwd,'.claude','commands'),'project'],[join(opencode,'commands'),'opencode'],[join(opencode,'command'),'opencode'],[join(cwd,'.opencode','commands'),'opencode-project'],[join(cwd,'.opencode','command'),'opencode-project']];
 for(const [root,scope] of sources){
  if(!existsSync(root)||(scope!=='scrum'&&config.claude_code?.commands===false))continue;
  let boundary;try{boundary=realpathSync(root)}catch(error){warn(error.message);continue}
  const visited=new Set();
  const visit=directory=>{
   let canonical;try{canonical=realpathSync(directory);if(!within(boundary,canonical)){warn('Command path outside command directory: '+directory);return}if(visited.has(canonical))return;visited.add(canonical)}catch(error){warn(error.message);return}
   for(const entry of readdirSync(directory).sort()){
    const path=join(directory,entry);try{
     const target=realpathSync(path);if(!within(boundary,target)){warn('Command path outside command directory: '+path);continue}const stat=statSync(target);if(stat.isDirectory()){visit(path);continue}if(!stat.isFile()||!entry.endsWith('.md'))continue;
     const name=relative(root,path).slice(0,-3).split(sep).join('/');if(names.has(name)||!configurationAllows(config,'commands',name))continue;
     const {metadata,body}=parse(readFileSync(path,'utf8'));const template=scope==='scrum'?body:'<command-instruction>\n'+body+'\n</command-instruction>\n\n<user-request>\n$ARGUMENTS\n</user-request>';
     commands.push({name,path,scope,description:typeof metadata.description==='string'?metadata.description:name,metadata,template});names.add(name);
    }catch(error){warn('Cannot load command '+path+': '+error.message)}
   }
  };try{visit(root)}catch(error){warn('Cannot scan commands '+root+': '+error.message)}
 }
 return commands;
}
