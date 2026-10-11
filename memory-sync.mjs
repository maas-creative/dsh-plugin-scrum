// Human-command opt-in adapter. Upstream MirrorSync is push-only main:main;
// explicit fetch/validated fast-forward are additional requested Scrum features.
import {execFileSync} from 'node:child_process';
import {isAbsolute,resolve} from 'node:path';
import {redactUrl,redactSecretLikeMaterial,scanSecretLikeMaterial} from './independent/secret-filter.mjs';
const CONFIG='omo.memoryRepository.url';
export function createMemorySync(memory){
 const git=args=>{try{return execFileSync('git',['-c','core.quotePath=false','-C',memory.directory,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:30000,maxBuffer:8*1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}}).trimEnd()}catch(error){throw Error(redactSecretLikeMaterial(redactUrl(error.stderr?.toString()||error.message)))}};
 const url=()=>{try{return git(['config','--local','--get',CONFIG])}catch{return null}};
 const configured=()=>{const value=url();if(!value)throw Error('No memory remote configured');return value};
 const validate=value=>{if(typeof value!=='string'||!value.trim()||value.startsWith('-')||/[\r\n\0]/.test(value)||value.includes('::'))throw Error('Invalid remote URL');const text=value.trim();if(isAbsolute(text))return resolve(text);if(/^[\w.-]+@[\w.-]+:[\w./-]+$/.test(text))return text;const parsed=new URL(text);if(!['https:','ssh:','file:'].includes(parsed.protocol)||parsed.password||parsed.username&&parsed.protocol==='https:')throw Error('Remote URL must not embed credentials');return text};
 const status=()=>({url:url()?redactUrl(url()):null,head:memory.head(),automaticPush:false});
 const configure=({remote}={})=>{const value=validate(remote);git(['config','--local',CONFIG,value]);return status()};
 const unset=()=>{if(url())git(['config','--local','--unset-all',CONFIG]);return status()};
 const fetch=()=>{const value=configured();git(['fetch','--no-tags',value,'refs/heads/main:refs/scrum-memory-remote/main']);return {fetched:true,sha:git(['rev-parse','refs/scrum-memory-remote/main'])}};
 const fastForward=async()=>{const expectedBase=memory.head();if(!expectedBase)throw Error('Use audited bundle restoration for an empty repository');const sha=git(['rev-parse','refs/scrum-memory-remote/main']);const result=await memory.applyCommit({expectedBase,sha});return {updated:true,...result}};
 const push=()=>{if(!memory.head())throw Error('Memory repository is empty');for(const commit of git(['rev-list','HEAD']).split('\n').filter(Boolean)){for(const path of git(['ls-tree','-r','--name-only',commit]).split('\n').filter(Boolean)){if(scanSecretLikeMaterial(path).length)throw Error('Memory history contains secret-like material');const body=git(['show',`${commit}:${path}`]);if(scanSecretLikeMaterial(body).length)throw Error('Memory history contains secret-like material')}}git(['push','--quiet',configured(),'HEAD:refs/heads/main']);return {pushed:true,sha:memory.head()}};
 return {configure,unset,status,fetch,fastForward,push};
}
