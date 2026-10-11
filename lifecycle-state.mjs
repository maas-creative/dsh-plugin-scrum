import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,renameSync,unlinkSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
export function lifecycleStateDir(env=process.env){return join(env.DSH_HOME||join(homedir(),'.dsh'),'scrum','lifecycle')}
export function readState(path,fallback=null){try{return JSON.parse(readFileSync(path,'utf8'))}catch(error){if(error.code==='ENOENT'||error instanceof SyntaxError)return fallback;throw error}}
export function writeState(path,value){mkdirSync(join(path,'..'),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';try{writeFileSync(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(tmp,path)}finally{try{unlinkSync(tmp)}catch(error){if(error.code!=='ENOENT')throw error}}}
export function claim(path,value){mkdirSync(join(path,'..'),{recursive:true});try{writeFileSync(path,JSON.stringify(value)+'\n',{flag:'wx',mode:0o600});return true}catch(error){if(error.code==='EEXIST')return false;throw error}}
export const hash=value=>createHash('sha256').update(value).digest('hex');
