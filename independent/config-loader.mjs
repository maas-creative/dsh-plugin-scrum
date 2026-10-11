// Scrum loader and validator. Rule data describes the public configuration API.
import{readFileSync,existsSync,realpathSync}from'node:fs';import{join,resolve,dirname}from'node:path';import{homedir}from'node:os';
import{parseJsonc,mergeOmoConfigRecords}from'./config-data.mjs';
const contract=JSON.parse(readFileSync(new URL('./config-rules.json',import.meta.url),'utf8'));
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const defaults={categories:{},agents:{},teams:{},task:{isolation:{enabled:false,backend:'auto',apply:true,merge:'patch',commits:'generic'},default_execution_mode:'auto',process_runner:'host',host_engine_policy:'upgrade',host_shard_prewarm:'first-turn',default_concurrency:5,global_concurrency:20,max_depth:1,residency_max_children:'unlimited',resident_idle_timeout_ms:900000,ttl_ms:86400000,resume_children:true,warnings:{unavailable_categories:true},wait:{min_ms:5000,default_ms:60000,max_ms:600000},team:{max_members:8,max_parallel_members:4,max_wall_clock_minutes:120}}};
function check(node,value,path='',depth=0){
 const issues=[];if(depth>128)return{value:undefined,issues:[{kind:'invalid-value',path,message:'Configuration nesting exceeds 128 levels'}]};
 let count=0;while(node.ref){node=contract.rules[node.ref];if(!node||++count>32)throw Error('Invalid packaged configuration rule')}
 const problem=message=>({value:undefined,issues:[{kind:'invalid-value',path,message}]});
 if(node.union){let best;for(const option of node.union){const result=check(option,value,path,depth+1);if(!result.issues.length)return result;if(!best||result.issues.length<best.issues.length)best=result}return best||problem('No supported value alternative')}
 if(node.kind){const valid=(Array.isArray(node.kind)?node.kind:[node.kind]).some(kind=>kind==='object'?object(value):kind==='array'?Array.isArray(value):kind==='integer'?typeof value==='number'&&Number.isInteger(value):kind==='number'?typeof value==='number'&&Number.isFinite(value):kind==='null'?value===null:typeof value===kind);if(!valid)return problem('Expected '+node.kind)}
 if(node.allowed&&!node.allowed.some(item=>Object.is(item,value)))return problem('Value is outside the allowed choices');
 if(typeof value==='number'){if(node.min!==undefined&&value<node.min||node.max!==undefined&&value>node.max||node.above!==undefined&&value<=node.above||node.below!==undefined&&value>=node.below)return problem('Number is outside its allowed range')}
 if(typeof value==='string'){const length=[...value].length;if(node.minChars!==undefined&&length<node.minChars||node.maxChars!==undefined&&length>node.maxChars)return problem('Text length is outside its allowed range');if(node.pattern&&!new RegExp(node.pattern).test(value))return problem('Text does not match the allowed pattern')}
 if(Array.isArray(value)){if(node.minItems!==undefined&&value.length<node.minItems||node.maxItems!==undefined&&value.length>node.maxItems)return problem('List size is outside its allowed range');const values=value.map((item,index)=>{const result=check(node.elements||{},item,path+'.'+index,depth+1);issues.push(...result.issues);return result.value});return{value:values,issues}}
 if(object(value)){
  const entries=[];for(const key of node.requiredFields||[])if(!Object.hasOwn(value,key))issues.push({kind:'invalid-value',path:path?path+'.'+key:key,message:'Required setting is missing'});
  for(const[key,item]of Object.entries(value)){const at=path?path+'.'+key:key;if(['__proto__','constructor','prototype'].includes(key)){issues.push({kind:'invalid-value',path:at,message:'Unsafe configuration field'});continue}const field=Object.hasOwn(node.fields||{},key)?node.fields[key]:node.extra;if(field===false){issues.push({kind:'unknown-keys',path:at,message:'Unrecognized configuration field'});continue}const result=check(object(field)?field:{},item,at,depth+1);entries.push([key,result.value]);issues.push(...result.issues)}return{value:Object.fromEntries(entries),issues};
 }
 return{value:structuredClone(value),issues};
}
function layerView(config,harness){const base=Object.fromEntries(Object.entries(config).filter(([key])=>!['profiles','[native]','[senpi]','[opencode]','[codex]'].includes(key)));if(harness==='native'||harness==='senpi')return mergeOmoConfigRecords(mergeOmoConfigRecords(base,config['[senpi]']||{}),config['[native]']||{});return mergeOmoConfigRecords(base,config['['+harness+']']||{})}
export function resolveIndependentConfigView({config,harness='native',profile}={}){
 if(!object(config))throw Error('Configuration must be an object');let result=layerView(config,harness);const diagnostics=[];
 if(profile){if(!Object.hasOwn(config.profiles||{},profile)||!object(config.profiles[profile]))diagnostics.push({kind:'profile',path:'profiles.'+profile,message:'Selected profile is unavailable; using base settings'});else{result=mergeOmoConfigRecords(result,layerView(config.profiles[profile],harness));return{config:result,diagnostics,profile}}}
 return{config:result,diagnostics};
}
function preferred(directory){for(const file of['omo.jsonc','omo.json']){const path=join(directory,'.omo',file);if(existsSync(path))return path}return join(directory,'.omo','omo.jsonc')}
export function resolveIndependentConfigPaths({cwd=process.cwd(),env=process.env}={}){
 const home=resolve(env.HOME||env.USERPROFILE||homedir()),user=preferred(home),paths=[{path:user,scope:'user'}],ancestors=[];
 for(let current=resolve(cwd);;current=dirname(current)){ancestors.unshift(current);if(dirname(current)===current)break}
 const seen=new Set([existsSync(user)?realpathSync(user):resolve(user)]);
 for(const directory of ancestors){const path=preferred(directory);if(!existsSync(path))continue;const identity=realpathSync(path);if(seen.has(identity))continue;seen.add(identity);paths.push({path,scope:'project'})}
 return paths;
}
export function loadIndependentConfig({cwd=process.cwd(),env=process.env,harness='native'}={}){
 const sources=[],layers=[],diagnostics=[];let merged={};
 for(const source of resolveIndependentConfigPaths({cwd,env})){
  const state={...source,exists:existsSync(source.path),loaded:false};sources.push(state);if(!state.exists)continue;
  try{const text=readFileSync(source.path,'utf8');if(Buffer.byteLength(text)>8*1024*1024)throw Error('Configuration exceeds 8 MiB');const errors=[],raw=parseJsonc(text,errors);if(errors.length||!object(raw)){diagnostics.push({kind:'parse',path:source.path,message:'Configuration is not a valid JSONC object'});continue}
   const result=check(contract.root,raw);for(const issue of result.issues)diagnostics.push({...issue,path:source.path,issuePaths:[issue.path]});state.loaded=true;layers.push({config:result.value,source:state});merged=mergeOmoConfigRecords(merged,result.value);
  }catch(error){diagnostics.push({kind:'read',path:source.path,message:error.message})}
 }
 const selected=(env.OMO_PROFILE||env.OCX_PROFILE||'').trim()||undefined,view=resolveIndependentConfigView({config:merged,harness,profile:selected});diagnostics.push(...view.diagnostics);
 return{config:mergeOmoConfigRecords(defaults,view.config),diagnostics,layers,sources,...(view.profile?{profile:view.profile}:{})};
}
