import {mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {homedir} from 'node:os';
import {randomUUID} from 'node:crypto';
export class DesktopLease {
 constructor({path=join(homedir(),'.dsh','desktop-input.lease')}={}){this.path=path;this.token=randomUUID();this.owner=null}
 inspect(){try{return JSON.parse(readFileSync(join(this.path,'owner.json'),'utf8'))}catch{return null}}
 acquire(session){if(this.owner===session)return {owner:session};mkdirSync(join(this.path,'..'),{recursive:true,mode:0o700});try{mkdirSync(this.path,{mode:0o700})}catch(e){if(e.code!=='EEXIST')throw e;throw Error('Desktop input owned by another session/process; stale leases require explicit human recovery')};try{writeFileSync(join(this.path,'owner.json'),JSON.stringify({session,pid:process.pid,token:this.token}),{mode:0o600});this.owner=session;return {owner:session}}catch(e){rmSync(this.path,{recursive:true,force:true});throw e}}
 assert(session){const owner=this.inspect();if(this.owner!==session||owner?.token!==this.token||owner?.pid!==process.pid)throw Error('Desktop owner lease required')}
 release(session){if(this.owner===session&&this.inspect()?.token===this.token){rmSync(this.path,{recursive:true,force:true});this.owner=null}return {released:true}}
 recover({humanRequested=false}={}){if(!humanRequested)throw Error('Explicit human recovery required');const owner=this.inspect();if(!owner)throw Error('Lease has no readable owner; inspect lock directory manually');try{process.kill(owner.pid,0);throw Error('Desktop lease owner process is still alive')}catch(e){if(e.code!=='ESRCH')throw e}rmSync(this.path,{recursive:true,force:true});return {recovered:true,previousOwner:owner.session}}
}
