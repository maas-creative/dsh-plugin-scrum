import {randomUUID} from 'node:crypto';import {join} from 'node:path';
import {readState,writeState,claim} from './lifecycle-state.mjs';
const captured=new Map();
const normalize=value=>String(value??'').trim().toLowerCase();
export function telemetryDisabled(config={},env=process.env){if(config.enabled===false||config.send_anonymous_telemetry===false||config.sendAnonymousTelemetry===false||['1','true','yes'].includes(normalize(env.DO_NOT_TRACK)))return true;return ['OMO','OMO_SENPI','DSH_SCRUM'].some(prefix=>['1','true','yes'].includes(normalize(env[prefix+'_DISABLE_POSTHOG']))||['0','false','no','yes'].includes(normalize(env[prefix+'_SEND_ANONYMOUS_TELEMETRY'])))}
export async function recordDailyActive({stateDir,config={},env=process.env,now=new Date(),version='0.0.0',transportFactory,timeoutMs=500,diagnostic=()=>{}}){
 if(telemetryDisabled(config,env)||typeof transportFactory!=='function')return {kind:'disabled'};
 const dayUTC=now.toISOString().slice(0,10),key=stateDir;if(captured.get(key)===dayUTC)return {kind:'dedup',dayUTC};
 let transport;try{transport=transportFactory({disableGeoip:true,enableExceptionAutocapture:false,disableRemoteConfig:true})}catch{diagnostic('transport-init-failed');return {kind:'failed'}};
 let timer;const work=(async()=>{try{const file=join(stateDir,'activity.json');if(readState(file,{})?.lastActiveDayUTC===dayUTC)return {kind:'dedup',dayUTC};captured.set(key,dayUTC);if(!claim(join(stateDir,'daily-claims',dayUTC),{dayUTC}))return {kind:'dedup',dayUTC};writeState(file,{lastActiveDayUTC:dayUTC});const identityPath=join(stateDir,'anonymous-id.json');claim(identityPath,{id:randomUUID()});const id=readState(identityPath)?.id;if(!/^[a-f0-9-]{36}$/.test(id||''))throw Error('Invalid anonymous identity');await transport.capture({distinctId:id,event:'scrum_daily_active',properties:{day_utc:dayUTC,product_name:'scrum',platform:'dsh',package_version:version,$process_person_profile:false}});await transport.flush?.();return {kind:'captured',dayUTC}}catch{diagnostic('capture-failed');return {kind:'failed'}}finally{try{await transport.shutdown?.()}catch{diagnostic('shutdown-failed')}}})();
 const timeout=new Promise(resolve=>{timer=setTimeout(()=>{diagnostic('timeout');resolve({kind:'timeout'})},timeoutMs)});try{return await Promise.race([work,timeout])}finally{clearTimeout(timer)}
}
