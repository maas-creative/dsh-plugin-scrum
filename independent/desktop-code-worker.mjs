import {parentPort,workerData} from 'node:worker_threads';
import {getQuickJS} from 'quickjs-emscripten';
import {runDesktopCodeCore,DESKTOP_METHODS} from './desktop-code.mjs';
const callbacks=new Map();let nextID=0;
parentPort.on('message',message=>{if(message?.type!=='reply')return;const pending=callbacks.get(message.id);if(!pending)return;callbacks.delete(message.id);message.error?pending.reject(Error(message.error)):pending.resolve(message.value)});
const call=(method,args)=>new Promise((resolve,reject)=>{const id=++nextID;callbacks.set(id,{resolve,reject});parentPort.postMessage({type:'call',id,method,args})});
const backend={};
for(const method of DESKTOP_METHODS){
 const target=method==='clipboard.read'?'clipboardRead':method==='clipboard.write'?'clipboardWrite':method;
 backend[target]=(...args)=>call(method,args.slice(0,-1));
}
try{
 const flag=new Int32Array(workerData.stopFlag);
 const result=await runDesktopCodeCore({QuickJS:await getQuickJS(),backend,...workerData,interruptCheck:()=>Atomics.load(flag,0)!==0});
 parentPort.postMessage({type:'result',value:result});
}catch(error){parentPort.postMessage({type:'error',message:error?.message||'Desktop sandbox failed'})}
