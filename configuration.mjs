import {tolerantFsyncSync} from './fsync-tracker.mjs';
import {OpenClawConfigSchema} from './independent/gateway-protocol.mjs';
import {tmuxConfigSchema} from './config-portable.mjs';
import {homedir} from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {skillsConfigSchema} from './skill-sources.mjs';
import {readFileSync,mkdirSync,writeFileSync,renameSync,statSync,unlinkSync,readdirSync,openSync,closeSync} from 'node:fs';import {resolve,join,relative,isAbsolute} from 'node:path';
import {loadIndependentConfig,resolveIndependentConfigView} from './independent/config-loader.mjs';
import {resolveModelReferences,parseJsonc,mergeOmoConfigRecords} from './independent/config-data.mjs';
import {runIndependentStartupMigration} from './independent/config-migration.mjs';
const lastValid=new Map(),portableKeys=['disabled_agents','disabled_commands','disabled_tools','disabled_hooks','disabled_mcps','disabled_providers'];
// Request-time resolution also finds newly created ancestor layers. A malformed
// edit keeps the last accepted view, rather than removing its permission switches.
export function loadScrumConfiguration({cwd=process.cwd(),env=process.env,warn=()=>{}}={}){
 const key=JSON.stringify([resolve(cwd),env.HOME||env.USERPROFILE,env.OMO_PROFILE,env.OCX_PROFILE,env.OPENCODE_CONFIG_DIR]);
 let cacheDirectory=resolve(env.SCRUM_CONFIG_CACHE_DIR||join(env.XDG_CACHE_HOME||join(env.HOME||homedir(),'.cache'),'scrum','config'));const cacheRelative=relative(resolve(cwd),cacheDirectory);if(cacheRelative===''||!cacheRelative.startsWith('..')&&!isAbsolute(cacheRelative))cacheDirectory=join(homedir(),'.cache','scrum','config');const cachePath=join(cacheDirectory,createHash('sha256').update(key).digest('hex')+'.json');
 const loaded=loadIndependentConfig({cwd,env,harness:'native'}),models=resolveModelReferences(loaded.config),config={...models.view};
 const diagnostics=[...loaded.diagnostics,...models.diagnostics];let raw={};
 for(const source of loaded.sources.filter(source=>source.loaded)){
  try{const errors=[],layer=parseJsonc(readFileSync(source.path,'utf8'),errors);if(errors.length)throw Error('Configuration changed during reading');raw=mergeOmoConfigRecords(raw,layer||{});}catch(error){diagnostics.push({kind:'read',path:source.path,message:error.message})}
 }
 const portable=resolveIndependentConfigView({config:raw,harness:'native',profile:loaded.profile}).config;
 for(const name of portableKeys){if(portable[name]===undefined)continue;if(!Array.isArray(portable[name])||portable[name].some(value=>typeof value!=='string'))diagnostics.push({kind:'invalid-value',path:'(merged omo config)',message:name+' must be a string array'});else config[name]=[...new Set(portable[name])];}
 if(portable.sisyphus!==undefined){const tasks=portable.sisyphus?.tasks;if(!tasks||typeof tasks!=='object'||Array.isArray(tasks)||['storage_path','task_list_id'].some(key=>tasks[key]!==undefined&&typeof tasks[key]!=='string'))diagnostics.push({kind:'invalid-value',message:'sisyphus.tasks requires string storage_path/task_list_id'});else config.sisyphus={tasks:structuredClone(tasks)};}
 if(portable.skills!==undefined){const value=portable.skills;if(skillsConfigSchema.safeParse(value).success)config.skills=structuredClone(value);else diagnostics.push({kind:'invalid-value',message:'skills must be a name array or configuration object'});}
 if(portable.tmux!==undefined){const validated=tmuxConfigSchema.safeParse(portable.tmux);if(validated.success)config.tmux=validated.data;else diagnostics.push({kind:'invalid-value',message:'Invalid tmux configuration: '+validated.error.issues.map(issue=>issue.path.join('.')+': '+issue.message).join('; ')});}
 if(portable.openclaw!==undefined){const validated=OpenClawConfigSchema.safeParse(portable.openclaw);if(validated.success)config.openclaw=validated.data;else diagnostics.push({kind:'invalid-value',message:'Invalid OpenClaw configuration'});}
 if(portable.auto_update!==undefined){if(typeof portable.auto_update!=='boolean')diagnostics.push({kind:'invalid-value',message:'auto_update must be boolean'});else config.auto_update=portable.auto_update;}
 const truncateAll=portable.experimental?.truncate_all_tool_outputs;if(truncateAll!==undefined){if(typeof truncateAll!=='boolean')diagnostics.push({kind:'invalid-value',message:'experimental.truncate_all_tool_outputs must be boolean'});else config.experimental={...config.experimental,truncate_all_tool_outputs:truncateAll};}
 const hashline=portable.hashline_edit??portable.experimental?.hashline_edit;if(hashline!==undefined){if(typeof hashline!=='boolean')diagnostics.push({kind:'invalid-value',message:'hashline_edit must be boolean'});else config.hashline_edit=hashline;}
 const effectiveDiagnostics=diagnostics.filter(d=>!(d.kind==='unknown-keys'&&d.issuePaths?.every(path=>portableKeys.includes(path.split('.').at(-1))||path==='sisyphus'||path==='hashline_edit'||path==='experimental'||path==='auto_update'||path==='skills'||path==='tmux'||path==='openclaw')));
 for(const diagnostic of effectiveDiagnostics)warn(`${diagnostic.path||'model'}: ${diagnostic.message}`);
 const rejected=effectiveDiagnostics.some(d=>!['deprecated-keys'].includes(d.kind));
 if(rejected&&!lastValid.has(key)){try{if(statSync(cachePath).size<=1024*1024){const cached=JSON.parse(readFileSync(cachePath,'utf8'));if(cached.key===key&&cached.config&&typeof cached.config==='object'&&!Array.isArray(cached.config)){lastValid.set(key,cached.config)}}}catch(error){if(error.code!=='ENOENT')warn('Configuration last-valid cache: '+error.message)}}
 if(rejected&&lastValid.has(key))return {...loaded,config:structuredClone(lastValid.get(key)),diagnostics:effectiveDiagnostics,retainedLastValid:true};
 if(!rejected){if(lastValid.size>=128&&!lastValid.has(key))lastValid.delete(lastValid.keys().next().value);lastValid.set(key,structuredClone(config));try{const body=JSON.stringify({key,config});if(Buffer.byteLength(body)>1024*1024)throw Error('Configuration cache exceeds size limit');mkdirSync(cacheDirectory,{recursive:true,mode:0o700});const temp=cachePath+'.'+randomUUID()+'.tmp';try{writeFileSync(temp,body,{mode:0o600,flag:'wx'});const fd=openSync(temp,'r+');try{tolerantFsyncSync(fd,'writeFileAtomically:'+cachePath)}finally{closeSync(fd)}renameSync(temp,cachePath);const directory=cacheDirectory,files=readdirSync(directory).filter(name=>/^[a-f0-9]{64}\.json$/.test(name)).map(name=>({path:join(directory,name),time:statSync(join(directory,name)).mtimeMs})).sort((a,b)=>b.time-a.time);for(const file of files.slice(128))unlinkSync(file.path)}finally{try{unlinkSync(temp)}catch(error){if(error.code!=='ENOENT')throw error}}}catch(error){warn('Configuration last-valid cache: '+error.message)}}
 return {...loaded,config,diagnostics:effectiveDiagnostics,retainedLastValid:false};
}
export function migrateScrumConfiguration({cwd=process.cwd(),env=process.env,...options}={}){
 return runIndependentStartupMigration({cwd,environment:env,env,homeDir:env.HOME||env.USERPROFILE,...options});
}
export function configurationAllows(config,kind,name){if(kind==='skills'&&(config?.skills?.disable?.includes(name)||config?.skills?.[name]===false||config?.skills?.[name]?.disable===true))return false;const disabled=config?.['disabled_'+kind];return !Array.isArray(disabled)||!disabled.includes(name);}
