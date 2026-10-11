import {spawn} from 'node:child_process';
import {isAbsolute} from 'node:path';

export class NativeDesktopStop {
 constructor({executable,args=[],onStop=()=>{}}={}) {
  if(typeof executable!=='string'||!isAbsolute(executable)||!Array.isArray(args)||args.some(x=>typeof x!=='string'))throw Error('Invalid native stop executable');
  this.executable=executable;this.args=args;this.onStop=onStop;this.status={globalLive:false,suspended:true};this.closed=false;
 }
 async open() {
  if(this.child||this.closed)throw Error('Native stop listener cannot be reopened');
  const child=spawn(this.executable,this.args,{stdio:['pipe','pipe','ignore']});this.child=child;
  this.exit=new Promise(resolve=>child.once('close',resolve));
  return await new Promise((resolve,reject)=>{
   let pending='',settled=false;
   const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value)};
   const fail=reason=>{this.status={globalLive:false,suspended:true,reason};this.onStop(this.status);finish(Error(reason));child.kill('SIGTERM')};
   const timer=setTimeout(()=>fail('Native stop startup timed out'),3000);
   child.stdout.on('data',bytes=>{
    if(this.closed)return;
    pending+=bytes.toString('utf8');if(Buffer.byteLength(pending)>8192)return fail('Invalid native stop response size');
    while(pending.includes('\n')){
     const newline=pending.indexOf('\n'),line=pending.slice(0,newline);pending=pending.slice(newline+1);
     let value;try{value=JSON.parse(line)}catch{return fail('Invalid native stop response')}
     if(typeof value.globalLive!=='boolean'||typeof value.suspended!=='boolean')return fail('Invalid native stop state');
     if(this.status.suspended&&settled&&!value.suspended)return fail('Native stop cannot implicitly resume');
     this.status=value;
     if(value.suspended||!value.globalLive)this.onStop(value);
     if(!settled){if(value.globalLive&&!value.suspended)finish(null,value);else finish(Error('Native global emergency stop unavailable'))}
    }
   });
   child.once('error',()=>fail('Native stop listener failed to start'));
   child.once('close',()=>{this.status={globalLive:false,suspended:true,reason:'Native stop listener exited'};if(!this.closed)this.onStop(this.status);finish(Error('Native stop listener exited before ready'))});
  }).catch(async error=>{await this.close();throw error});
 }
 assertLive(){if(this.closed||!this.status.globalLive||this.status.suspended)throw Error('Native global emergency stop unavailable or suspended');return this.status}
 async close(){
  if(this.closePromise)return this.closePromise;
  this.closed=true;this.status={globalLive:false,suspended:true};const child=this.child;
  this.closePromise=(async()=>{if(!child)return;child.stdin.end();const timer=setTimeout(()=>child.kill('SIGKILL'),500);try{await this.exit}finally{clearTimeout(timer)}})();return this.closePromise;
 }
}
