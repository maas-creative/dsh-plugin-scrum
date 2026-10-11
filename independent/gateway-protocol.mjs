// Scrum gateway contracts and transports. Persistent protocol identifiers remain
// stable so an upgrade does not replay already accepted notifications.
import {z} from 'zod';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
const listener=z.object({discordBotToken:z.string().optional(),discordChannelId:z.string().optional(),discordMention:z.string().optional(),authorizedDiscordUserIds:z.array(z.string()).default([]),telegramBotToken:z.string().optional(),telegramChatId:z.string().optional(),pollIntervalMs:z.number().default(3000),rateLimitPerMinute:z.number().default(10),maxMessageLength:z.number().default(500),includePrefix:z.boolean().default(true)}).strict();
export const OpenClawConfigSchema=z.object({enabled:z.boolean().default(false),gateways:z.record(z.string(),z.object({type:z.enum(['http','command']).default('http'),url:z.string().optional(),method:z.string().default('POST'),headers:z.record(z.string(),z.string()).optional(),command:z.string().optional(),timeout:z.number().optional()}).strict()).default({}),hooks:z.record(z.string(),z.object({enabled:z.boolean().default(true),gateway:z.string(),instruction:z.string()}).strict()).default({}),replyListener:listener.optional()}).strict();
const bounded=(value,fallback,min,max)=>Math.min(max,Math.max(min,Number.isFinite(value)?value:fallback));
export function normalizeReplyListenerConfig(config){if(!config.replyListener)return structuredClone(config);return {...structuredClone(config),replyListener:{...structuredClone(config.replyListener),authorizedDiscordUserIds:[...(config.replyListener.authorizedDiscordUserIds||[])],pollIntervalMs:bounded(config.replyListener.pollIntervalMs,3000,500,60000),rateLimitPerMinute:bounded(config.replyListener.rateLimitPerMinute,10,1,Number.MAX_SAFE_INTEGER),maxMessageLength:bounded(config.replyListener.maxMessageLength,500,1,4000),includePrefix:config.replyListener.includePrefix??true}};}
export function resolveGateway(config,event){const hook=config.enabled&&config.hooks?.[event],gateway=hook?.enabled&&config.gateways?.[hook.gateway];return gateway?{gatewayName:hook.gateway,gateway,instruction:hook.instruction}:null;}
export function interpolateInstruction(text,variables){return String(text).replace(/\{\{(\w+)\}\}/g,(_match,key)=>String(variables[key]??''));}
const escape=text=>text.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const identifier=(value,name)=>{if(typeof value!=='string'||!value||value.length>2000)throw Error('Invalid gateway '+name);return value;};
function ruleBlock(version,behavioral){return '<operating-rules version="'+escape(version)+'">\n'+behavioral.map(rule=>'- '+rule.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')).join('\n')+(behavioral.length?'\n':'')+'</operating-rules>';}
export function blockForSession(adapter,{session_durable_id}){identifier(session_durable_id,'session');return adapter.one(['session_durable_id','scope','version','block','updated_at'],'SELECT session_durable_id,scope,version,block,updated_at FROM gateway_rules_blocks WHERE session_durable_id=?',[session_durable_id])||null;}
export function composeGatewayRulesBlock(base,block){return [base?.trim(),block?'<scrum-gateway-rules>\n'+block+'\n</scrum-gateway-rules>':null].filter(Boolean).join('\n\n');}
export async function rulesCommitted(adapter,{scope,version,targets,now=Date.now()}){
 identifier(scope,'scope');identifier(version,'version');if(!Array.isArray(targets)||targets.length>1000||!Number.isFinite(now))throw Error('Invalid gateway rules targets or timestamp');
 const seen=new Set(),prepared=targets.map(target=>{identifier(target.session_durable_id,'session');if(seen.has(target.session_durable_id))throw Error('Duplicate gateway rules target');seen.add(target.session_durable_id);if(target.binding_id!==undefined)identifier(target.binding_id,'binding');if(target.behavioral!==null&&(!Array.isArray(target.behavioral)||target.behavioral.length>1000||target.behavioral.some(rule=>typeof rule!=='string'||rule.length>100000)))throw Error('Gateway behavioral rules must be strings or null');return {...target,block:target.behavioral===null?null:ruleBlock(version,target.behavioral)};});
 if(prepared.some(target=>target.block&&Buffer.byteLength(target.block)>1024*1024)||prepared.reduce((sum,target)=>sum+Buffer.byteLength(target.block||''),0)>8*1024*1024)throw Error('Gateway rules exceed the storage limit');
 const outcomes=[];
 for(const target of prepared){const existing=blockForSession(adapter,target);if(target.block===null){adapter.exec('DELETE FROM gateway_rules_blocks WHERE session_durable_id=?',[target.session_durable_id]);outcomes.push({session_durable_id:target.session_durable_id,outcome:'removed'});continue;}
  if(existing?.scope===scope&&existing.version===version&&existing.block!==target.block)throw Error('Gateway rules revision conflict');
  const equivalent=existing?.scope===scope&&existing.version===version&&existing.block===target.block;
  if(!equivalent)adapter.exec('INSERT INTO gateway_rules_blocks(session_durable_id,scope,version,block,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(session_durable_id) DO UPDATE SET scope=excluded.scope,version=excluded.version,block=excluded.block,updated_at=excluded.updated_at',[target.session_durable_id,scope,version,target.block,now]);
  const outcome={session_durable_id:target.session_durable_id,outcome:'updated'};
  if(target.binding_id)outcome.delivery=await adapter.enqueue({binding_id:target.binding_id,event_id:'rules_changed:'+scope+':'+version+':'+target.session_durable_id,mode:'follow_up',text:'Gateway instructions have been updated. Apply the current session rules before continuing.\n\n'+target.block,...(equivalent?{equivalentRule:{sessionId:target.session_durable_id,scope,version,block:target.block}}:{})});
  outcomes.push(outcome);
 }
 return {scope,version,outcomes};
}
export const resolveCommandTimeoutMs=value=>bounded(value,5000,100,300000);
function transportResult(gateway,success,extras={}){return {gateway,success,...extras};}
function endpoint(value){const url=new URL(value);if(url.username||url.password)throw Error('Embedded gateway credentials are not supported');if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Gateway requires HTTPS or loopback HTTP');return url;}
async function responseBody(response){const chunks=[];let length=0;for await(const chunk of response.body||[]){length+=chunk.byteLength;if(length>256*1024)throw Error('Gateway response exceeds 256 KiB');chunks.push(chunk);}return Buffer.concat(chunks).toString('utf8');}
function messageId(text){try{const value=JSON.parse(text);return typeof value.messageId==='string'||typeof value.messageId==='number'?String(value.messageId):undefined;}catch{return undefined;}}
export async function wakeGateway(name,gateway,payload){
 let statusCode;
 try{const url=endpoint(gateway.url),method=(gateway.method||'POST').toUpperCase();if(!/^[A-Z]+$/.test(method))throw Error('Invalid HTTP method');const body=JSON.stringify(payload);if(Buffer.byteLength(body)>1024*1024)throw Error('Gateway payload exceeds 1 MiB');const response=await fetch(url,{method,headers:{'Content-Type':'application/json',...gateway.headers},body:['GET','HEAD'].includes(method)?undefined:body,redirect:'manual',signal:AbortSignal.timeout(resolveCommandTimeoutMs(gateway.timeout))});statusCode=response.status;if(!response.ok){await response.body?.cancel();return transportResult(name,false,{statusCode,error:'Gateway HTTP '+statusCode});}const text=await responseBody(response),id=messageId(text);return transportResult(name,true,{statusCode,...(id!==undefined?{messageId:id}:{})});}
 catch(error){return transportResult(name,false,{...(statusCode!==undefined?{statusCode}:{}),error:error.name==='TimeoutError'?'Gateway request timed out':error.message.startsWith('Gateway')||error.message.startsWith('Embedded')||error.message==='Invalid HTTP method'?error.message:'Gateway request failed'});}
}
// Expand values through environment parameters. The shell never reparses their
// bytes as syntax, including when a placeholder is inside template quotes.
function commandInput(template,variables){if(typeof template!=='string'||!template.trim()||Buffer.byteLength(template)>65536)throw Error('Gateway command is empty or exceeds 64 KiB');const env={...process.env},prefix='SCRUM_GATEWAY_'+randomBytes(8).toString('hex')+'_';let command='',quote='',escaped=false,index=0;for(let pos=0;pos<template.length;pos++){
 const tail=template.slice(pos),match=!escaped&&tail.match(/^\{\{(\w+)\}\}/);if(match){const key=prefix+index++,value=String(variables[match[1]]??'');if(value.includes('\0')||Buffer.byteLength(value)>1024*1024)throw Error('Gateway command argument is invalid or too large');env[key]=value;command+=quote==="'"?'\'"${'+key+'}"\'':quote==='"'?'${'+key+'}':'"${'+key+'}"';pos+=match[0].length-1;continue;}
 const character=template[pos];command+=character;if(escaped){escaped=false;continue;}if(character==='\\'&&quote!=="'"){escaped=true;continue;}if(character===quote)quote='';else if(!quote&&(character==='"'||character==="'"))quote=character;
 }return {command,env};}
export async function wakeCommandGateway(name,gateway,variables){
 let input;try{input=commandInput(gateway.command,variables)}catch(error){return transportResult(name,false,{error:error.message})}
 return new Promise(resolve=>{const child=spawn('/bin/sh',['-c',input.command],{env:input.env,detached:process.platform!=='win32',stdio:['ignore','pipe','pipe']}),decoder=new StringDecoder('utf8');let output='',bytes=0,failure,timer,termination,settled=false;
  const terminate=()=>{if(termination)return;termination=new Promise(done=>{try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGTERM')}catch{}setTimeout(()=>{try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL')}catch{}done()},100)});};
  const finish=async extras=>{if(settled)return;settled=true;clearTimeout(timer);await termination;resolve(transportResult(name,!failure&&extras.exitCode===0,{...extras,...(failure?{error:failure}:{})}));};
  child.on('error',()=>{failure='Gateway command could not start';finish({exitCode:null})});
  child.stdout.on('data',chunk=>{bytes+=chunk.length;if(bytes>256*1024){if(!failure){failure='Gateway command output exceeds 256 KiB';terminate()}return;}output+=decoder.write(chunk)});child.stderr.on('data',chunk=>{bytes+=chunk.length;if(bytes>256*1024&&!failure){failure='Gateway command output exceeds 256 KiB';terminate()}});
  child.on('close',(exitCode,signal)=>{output+=decoder.end();if(exitCode!==0&&!failure)failure='Gateway command failed';const id=messageId(output.trim());finish({exitCode,...(signal?{signal}:{}),...(!failure&&id!==undefined?{messageId:id}:{})});});
  timer=setTimeout(()=>{failure='Gateway command timed out';terminate()},resolveCommandTimeoutMs(gateway.timeout));
 });
}
