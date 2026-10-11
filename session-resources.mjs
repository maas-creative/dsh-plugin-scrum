// Persistence disappearance is deletion only after a successful presence probe.
export class SessionResources {
 constructor({stat,cleanup,onError=()=>{}}){this.stat=stat;this.cleanup=cleanup;this.onError=onError;this.known=new Map();this.retired=new Set();this.running=false}
 async observe(id){if(!id)return;if(this.retired.has(id))throw Error('Session was deleted');if(!this.known.has(id))this.known.set(id,false);if(await this.stat(id))this.known.set(id,true)}
 async reconcile(){if(this.running)return;this.running=true;try{for(const [id,present]of this.known){try{const exists=await this.stat(id);if(exists)this.known.set(id,true);else if(present){this.retired.add(id);await this.cleanup(id);this.known.delete(id)}}catch(error){this.onError(id,error)}}}finally{this.running=false}}
}
