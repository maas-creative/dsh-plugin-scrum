// Claude permission update schema: https://code.claude.com/docs/en/hooks#permission-update-entries
// This policy is additional to DSH's immutable tool visibility and monotonic guards.
import {readFile,mkdir,writeFile,rename,rm,symlink,readlink} from 'node:fs/promises';
import {join,dirname,resolve} from 'node:path';import {homedir} from 'node:os';import {randomUUID} from 'node:crypto';
async function acquireLock(path,depth=0){
 const owner=JSON.stringify({pid:process.pid,id:randomUUID()});try{await symlink(owner,path);return;}catch(error){if(error.code!=='EEXIST')throw error;}
 assert(depth<4,'Permission lock recovery depth exceeded');const recovery=path+'.recover';await acquireLock(recovery,depth+1);
 try{let existing;try{existing=JSON.parse(await readlink(path))}catch(error){if(error.code==='ENOENT'){await symlink(owner,path);return;}throw error;}assert(Number.isSafeInteger(existing.pid)&&existing.pid>0,'Invalid permission lock owner');try{process.kill(existing.pid,0);throw Object.assign(Error('Permission settings are locked by a live process'),{code:'EEXIST'});}catch(error){if(error.code!=='ESRCH')throw error;}await rm(path,{force:true});await symlink(owner,path);
 }finally{await rm(recovery,{force:true});}
}
const destinations=['session','localSettings','projectSettings','userSettings'],behaviors=['allow','deny','ask'],modes=['default','manual','auto','acceptEdits','dontAsk','bypassPermissions','plan'];
const empty=()=>({allow:[],deny:[],ask:[],additionalDirectories:[]});
const assert=(condition,message)=>{if(!condition)throw Error(message)};
export function validatePermissionUpdates(updates){
 assert(Array.isArray(updates)&&updates.length<=100,'updatedPermissions must be an array of at most 100 updates');
 return updates.map(update=>{assert(update&&typeof update==='object'&&!Array.isArray(update),'Invalid permission update');const value=structuredClone(update);assert(destinations.includes(value.destination),'Invalid permission destination');
 if(['addRules','replaceRules','removeRules'].includes(value.type)){assert(behaviors.includes(value.behavior)&&Array.isArray(value.rules)&&value.rules.length<=100,'Invalid permission rules');for(const rule of value.rules)assert(rule&&typeof rule.toolName==='string'&&rule.toolName.length>0&&rule.toolName.length<=200&&/^[\w*.-]+$/.test(rule.toolName)&&(rule.ruleContent===undefined||typeof rule.ruleContent==='string'&&rule.ruleContent.length<=4000),'Invalid permission rule');}
 else if(value.type==='setMode')assert(modes.includes(value.mode),'Invalid permission mode');
 else if(['addDirectories','removeDirectories'].includes(value.type))assert(Array.isArray(value.directories)&&value.directories.length<=100&&value.directories.every(path=>typeof path==='string'&&path.trim()&&path.length<=4000),'Invalid permission directories');
 else throw Error('Unknown permission update type');return value;});
}
export const encodePermissionRule=rule=>rule.toolName+(rule.ruleContent===undefined?'':'('+rule.ruleContent+')');
export function applyPermissionUpdate(previous,update,{cwd,allowBypass=false}={}){
 const state={...empty(),...structuredClone(previous)},key=update.behavior;
 if(update.type==='addRules')state[key]=[...new Set([...(state[key]||[]),...update.rules.map(encodePermissionRule)])];
 else if(update.type==='replaceRules')state[key]=[...new Set(update.rules.map(encodePermissionRule))];
 else if(update.type==='removeRules'){const removed=new Set(update.rules.map(encodePermissionRule));state[key]=(state[key]||[]).filter(rule=>!removed.has(rule));}
 else if(update.type==='setMode'){if(update.mode==='bypassPermissions'&&!allowBypass)return state;state.defaultMode=update.mode==='manual'?'default':update.mode;}
 else {const dirs=update.directories.map(path=>resolve(cwd,path));state.additionalDirectories=update.type==='addDirectories'?[...new Set([...(state.additionalDirectories||[]),...dirs])]:(state.additionalDirectories||[]).filter(path=>!dirs.includes(resolve(cwd,path)));}
 return state;
}
const glob=(pattern,value)=>{let p=0,v=0,star=-1,retry=0;while(v<value.length){if(pattern[p]===value[v]){p++;v++;}else if(pattern[p]==='*'){star=p++;retry=v;}else if(star>=0){p=star+1;v=++retry;}else return false;}while(pattern[p]==='*')p++;return p===pattern.length;};
const planTools=new Set(['read','read_image','glob','grep','project_search','web_search','websearch','webfetch','fetch_content','get_search_content','skill','scrum_report','ast_grep_search','ast_grep_scan','hashline_read','lsp_status','lsp_diagnostics','lsp_prepare_rename','lsp_goto_definition','lsp_find_references','lsp_symbols','session_list','session_info','session_read','session_search','memory_read','memory_search','memory_recall','task_list','task_get','team_list','team_get','team_messages','monitor_list','background_output','browser_snapshot','computer_snapshot'].map(name=>name.replace(/[-_\s]/g,'').toLowerCase()));
function matchesRule(rule,name,args,cwd){
 const parsed=/^([^()]+)(?:\((.*)\))?$/.exec(rule);if(!parsed||!glob(parsed[1].toLowerCase(),name.toLowerCase()))return false;if(parsed[2]===undefined)return true;
 const target=args.command??args.file_path??args.filePath??args.path??args.url;if(typeof target!=='string')return false;let pattern=parsed[2];if(name.toLowerCase()==='bash'&&pattern.endsWith(':*'))return target===pattern.slice(0,-2)||target.startsWith(pattern.slice(0,-2)+' ');
 return glob(pattern,target)||(['read','write','edit'].includes(name.toLowerCase())&&glob(resolve(cwd,pattern),resolve(cwd,target)));
}
// Only simple shell lists can receive rule-based approval. Expansion/control syntax
// stays with DSH's native permission evaluator rather than pretending it is parsed.
function shellSegments(command){
 const segments=[];let quote=null,start=0,escaped=false,uncertain=false;
 for(let i=0;i<command.length;i++){const c=command[i];if(escaped){escaped=false;continue;}if(c==='\\'&&quote!=="'"){escaped=true;continue;}if(quote){if(c===quote)quote=null;else if(quote==='"'&&(c==='$'||c==='`'))uncertain=true;continue;}if(c==='"'||c==="'"){quote=c;continue;}if('$`(){}<>#'.includes(c))uncertain=true;if(c===';'||c==='|'||c==='&'||c==='\n'){const part=command.slice(start,i).trim();if(part)segments.push(part);while(command[i+1]===c&&(c==='|'||c==='&'))i++;start=i+1;}}
 const last=command.slice(start).trim();if(last)segments.push(last);if(quote||escaped||!segments.length)uncertain=true;return {segments,uncertain};
}
export function permissionDecision(states,name,args,{cwd,allowBypass=false}={}){
 const shell=name.toLowerCase()==='bash'&&typeof args.command==='string'?shellSegments(args.command):null;
 const matchesOne=(behavior,input)=>states.some(state=>(state[behavior]||[]).some(rule=>matchesRule(rule,name,input,cwd)));
 const matches=behavior=>shell?(behavior==='allow'?!shell.uncertain&&shell.segments.every(command=>matchesOne(behavior,{...args,command})):matchesOne(behavior,args)||shell.segments.some(command=>matchesOne(behavior,{...args,command}))):matchesOne(behavior,args);
 if(matches('deny'))return {kind:'deny',reason:'Configured Claude deny rule'};if(matches('ask'))return {kind:'ask',reason:'Configured Claude ask rule'};
 const mode=states.map(state=>state.defaultMode).filter(Boolean).at(-1)||'default';if(mode==='plan'&&!planTools.has(name.replace(/[-_\s]/g,'').toLowerCase()))return {kind:'deny',reason:'Configured plan mode is read-only'};
 if(matches('allow'))return {kind:'allow'};if(mode==='dontAsk')return {kind:'deny',reason:'Configured dontAsk mode rejects unapproved tools'};if(mode==='bypassPermissions'&&allowBypass)return {kind:'allow'};if(mode==='acceptEdits'&&['write','edit','hashlineedit'].includes(name.replace(/[-_\s]/g,'').toLowerCase()))return {kind:'allow'};return {kind:'inherit',mode};
}
export class ClaudePermissions {
 constructor({home=homedir(),allowBypass=false,activateMode,persistSession,activateDirectories}={}){this.home=home;this.allowBypass=allowBypass;this.activateMode=activateMode;this.persistSession=persistSession;this.activateDirectories=activateDirectories;this.sessions=new WeakMap();this.pending=Promise.resolve();}
 paths(agent){const cwd=agent.session.header.cwd||process.cwd();return {cwd,session:null,userSettings:join(this.home,'.claude/settings.json'),projectSettings:join(cwd,'.claude/settings.json'),localSettings:join(cwd,'.claude/settings.local.json')};}
 async document(path){try{const text=await readFile(path,'utf8');assert(Buffer.byteLength(text)<=1024*1024,'Permission settings exceed 1MB');const value=JSON.parse(text);assert(value&&typeof value==='object'&&!Array.isArray(value),'Invalid permission settings');return {text,value};}catch(error){if(error.code==='ENOENT')return {text:null,value:{}};throw error;}}
 sessionState(agent){const records=agent.session.snapshotEvents?.()||[],saved=records.filter(event=>event.type==='scrum/claude-permissions'&&event.data.ownerSessionId===agent.session.id).at(-1);return saved?structuredClone(saved.data.permissions):this.sessions.get(agent)||empty();}
 async state(agent){const paths=this.paths(agent),states=[];for(const destination of ['userSettings','projectSettings','localSettings'])states.push((await this.document(paths[destination])).value.permissions||empty());states.push(this.sessionState(agent));return states;}
 async decision(agent,name,args){const states=await this.state(agent);await this.activateDirectories?.(agent,[...new Set(states.flatMap(state=>state.additionalDirectories||[]).map(path=>resolve(this.paths(agent).cwd,path)))]);return permissionDecision(states,name,args,{cwd:this.paths(agent).cwd,allowBypass:this.allowBypass});}
 async apply(agent,updates){const validated=validatePermissionUpdates(updates),run=async()=>{
 if(validated.some(update=>update.type==='setMode'&&update.mode==='auto')&&!this.activateMode)throw Error('Auto mode requires the native DSH permission adapter');
 const priorStates=await this.state(agent),paths=this.paths(agent),session=structuredClone(this.sessionState(agent)),documents=new Map(),locks=[],written=[];let nextSession=session,recorded=false;
 try{
 for(const destination of [...new Set(validated.map(v=>v.destination).filter(v=>v!=='session'))].sort()){const path=paths[destination];await mkdir(dirname(path),{recursive:true});const lock=path+'.scrum-lock';await acquireLock(lock);locks.push(lock);documents.set(destination,{path,...await this.document(path)});}
 for(const update of validated){if(update.destination==='session')nextSession=applyPermissionUpdate(nextSession,update,{cwd:paths.cwd,allowBypass:this.allowBypass});else {const document=documents.get(update.destination);const effective={...update};if(effective.type==='setMode'&&effective.mode==='bypassPermissions')continue;document.value={...document.value,permissions:applyPermissionUpdate(document.value.permissions||empty(),effective,{cwd:paths.cwd,allowBypass:this.allowBypass})};}}
 for(const document of documents.values()){assert((await this.document(document.path)).text===document.text,'Permission settings changed concurrently');const temporary=document.path+'.'+randomUUID()+'.tmp';try{const updated=JSON.stringify(document.value,null,2)+'\n';await writeFile(temporary,updated,{mode:0o600,flag:'wx'});await rename(temporary,document.path);written.push({...document,updated});}finally{await rm(temporary,{force:true});}}
 const ordered=['userSettings','projectSettings','localSettings'];const states=ordered.map((destination,index)=>documents.get(destination)?.value.permissions||priorStates[index]);states.push(nextSession);const selectedMode=states.map(state=>state.defaultMode).filter(Boolean).at(-1)||'default';if(validated.some(update=>update.type==='setMode'))await this.activateMode?.(agent,selectedMode);
 if(validated.some(update=>['addDirectories','removeDirectories'].includes(update.type)))await this.activateDirectories?.(agent,[...new Set(states.flatMap(state=>state.additionalDirectories||[]).map(path=>resolve(paths.cwd,path)))]);
 if(validated.some(update=>update.destination==='session')&&agent.session.append){agent.session.append('scrum/claude-permissions',{ownerSessionId:agent.session.id,permissions:nextSession});recorded=true;await this.persistSession?.(agent.session);}
 this.sessions.set(agent,nextSession);return {applied:validated.length,destinations:[...new Set(validated.map(v=>v.destination))]};
 }catch(error){const recoveryErrors=[];try{if(validated.some(update=>['addDirectories','removeDirectories'].includes(update.type)))await this.activateDirectories?.(agent,[...new Set(priorStates.flatMap(state=>state.additionalDirectories||[]).map(path=>resolve(paths.cwd,path)))]);if(validated.some(update=>update.type==='setMode'))await this.activateMode?.(agent,priorStates.map(state=>state.defaultMode).filter(Boolean).at(-1)||'default');}catch(failure){recoveryErrors.push(failure);}if(recorded){try{agent.session.append('scrum/claude-permissions',{ownerSessionId:agent.session.id,permissions:session,rollback:true});await this.persistSession?.(agent.session);}catch(failure){recoveryErrors.push(failure);}}for(const document of written.reverse())try{if((await this.document(document.path)).text===document.updated){if(document.text===null)await rm(document.path,{force:true});else {const temporary=document.path+'.rollback-'+randomUUID();await writeFile(temporary,document.text,{mode:0o600});await rename(temporary,document.path);}}}catch(failure){recoveryErrors.push(failure);}if(recoveryErrors.length)throw new AggregateError([error,...recoveryErrors],'Permission update failed: '+error.message+'; rollback also failed; inspect durable state before retry');throw error;
 }finally{for(const lock of locks)await rm(lock,{force:true});}
 };const work=this.pending.then(run,run);this.pending=work.catch(()=>{});return work;}
}
