import {Worker} from 'node:worker_threads';
import {DESKTOP_HANDLES_SOURCE} from './desktop-handles.mjs';
const READONLY=new Set(['capabilities','displays','windows','window','focusedWindow','focusedElement','elementAt','ref','clipboard.read','screenshot','windowRead','elementRead']);
export const DESKTOP_METHODS=['capabilities','displays','windows','window','focusedWindow','focusedElement','elementAt','ref','clipboard.read','clipboard.write','screenshot','click','doubleClick','move','type','press','scroll','drag','windowRead','windowInput','elementRead','elementInput'];
const METHODS=DESKTOP_METHODS;
// QuickJS is a separate WASM interpreter. Host objects/functions are never
// exposed as JavaScript values in the guest context.
export async function runDesktopCodeCore({QuickJS,backend,code,readOnly=true,signal,timeoutMs=30000,memoryBytes=32*1024*1024,interruptCheck=()=>false}={}) {
 if(!QuickJS||!backend||typeof code!=='string'||Buffer.byteLength(code)>256*1024||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isInteger(memoryBytes)||memoryBytes<1024*1024||memoryBytes>64*1024*1024)throw Error('Invalid desktop sandbox request');
 signal?.throwIfAborted();
 const controller=new AbortController(),abort=()=>controller.abort(signal.reason||Error('Desktop run aborted'));
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const deadline=Date.now()+timeoutMs,runtime=QuickJS.newRuntime();runtime.setMemoryLimit(memoryBytes);runtime.setMaxStackSize(512*1024);runtime.setInterruptHandler(()=>controller.signal.aborted||interruptCheck()||Date.now()>=deadline);
 const vm=runtime.newContext(),deferreds=new Set(),jobs=new Set(),displays=[];let closed=false,resultHandle,sequence=Promise.resolve();
 const serialize=value=>{const text=JSON.stringify(value);if(text===undefined)return 'null';if(Buffer.byteLength(text)>12*1024*1024)throw Error('Desktop value exceeds limit');return text};
 const valueHandle=(value,name,args)=>{
  const json=`JSON.parse(${JSON.stringify(serialize(value))})`;
  let expression=json;
  if(['window','focusedWindow'].includes(name))expression=`__scrumWindow(${json})`;
  if(['ref','focusedElement','elementAt'].includes(name))expression=`__scrumElement(${json})`;
  if(name==='windowRead'&&args[0]?.method==='ref')expression=`__scrumElement(${json})`;
  if(name==='windowRead'&&args[0]?.method==='find'||name==='elementRead'&&args[0]?.method==='children')expression=`${json}.map(__scrumElement)`;
  if(name==='elementRead'&&args[0]?.method==='parent')expression=`__scrumElement(${json})`;
  return vm.unwrapResult(vm.evalCode(expression));
 };
 const desktop=vm.newObject(),clipboard=vm.newObject();vm.setProp(desktop,'clipboard',clipboard);
 try{
  for(const name of METHODS){
   const fn=vm.newFunction(name,(...handles)=>{
    if(jobs.size>=32)return {error:vm.newError('Too many pending desktop operations')};
    if(readOnly&&!READONLY.has(name))return {error:vm.newError('Desktop input is read-only')};
    let args;try{args=handles.map(handle=>vm.dump(handle));if(args.length>(name==='elementAt'?2:1)||Buffer.byteLength(serialize(args))>65536||args.some(arg=>typeof arg==='function'))throw Error('Invalid desktop argument')}catch{return {error:vm.newError('Invalid desktop argument')}}
    if(!['window','ref','elementAt','clipboard.write','type','press'].includes(name)&&args.length&&(!args[0]||typeof args[0]!=='object'||Array.isArray(args[0])))return {error:vm.newError('Invalid desktop argument')};
    const deferred=vm.newPromise();deferreds.add(deferred);
    const operation=sequence.then(async()=>{
     controller.signal.throwIfAborted();if(Date.now()>=deadline)throw Error('Desktop run timed out');
     const method=name==='clipboard.read'?'clipboardRead':name==='clipboard.write'?'clipboardWrite':name;
     const value=await backend[method](...(args.length?args:[{}]),{signal:controller.signal,timeoutMs:Math.max(1,deadline-Date.now())});
     let returned=value;
     if(value?.mimeType==='image/png'&&typeof value.data==='string'){
      if(displays.reduce((bytes,image)=>bytes+Buffer.byteLength(image.data),0)+Buffer.byteLength(value.data)>64*1024*1024)throw Error('Desktop capture aggregate exceeds limit');
      displays.push({type:'image',mimeType:value.mimeType,data:value.data});
      const {data,mimeType,receipt,...metadata}=value;returned=metadata;
     }
     if(!closed){const handle=valueHandle(returned,name,args);try{deferred.resolve(handle)}finally{handle.dispose()}}
    }).catch(error=>{if(!closed){const handle=vm.newError(error?.message||'Desktop operation failed');try{deferred.reject(handle)}finally{handle.dispose()}}}).finally(()=>jobs.delete(operation));
    sequence=operation;jobs.add(operation);return deferred.handle;
   });vm.setProp(name.startsWith('clipboard.')?clipboard:desktop,name.startsWith('clipboard.')?name.split('.')[1]:name,fn);fn.dispose();
  }
  vm.setProp(vm.global,'desktop',desktop);clipboard.dispose();desktop.dispose();
  const setup=vm.unwrapResult(vm.evalCode(DESKTOP_HANDLES_SOURCE));setup.dispose();
  resultHandle=vm.unwrapResult(vm.evalCode(`(async()=>{\n${code}\n})()`,'desktop-run.js'));
  while(true){
   controller.signal.throwIfAborted();if(Date.now()>=deadline)throw Error('Desktop run timed out');
   const pending=runtime.executePendingJobs();if(pending.error){const error=vm.dump(pending.error);pending.error.dispose();throw Error(error?.message||'Desktop sandbox job failed')}
   const state=vm.getPromiseState(resultHandle);
   if(state.type==='rejected'){const error=vm.dump(state.error);state.error.dispose();throw Error(error?.message||'Desktop sandbox rejected')}
   if(state.type==='fulfilled'){const value=vm.dump(state.value);state.value.dispose();if(!jobs.size){serialize(value);return {returnValue:value,displays}}}
   await new Promise(resolve=>setTimeout(resolve,5));
  }
 }finally{
  closed=true;controller.abort(Error('Desktop sandbox closed'));signal?.removeEventListener('abort',abort);
  await Promise.allSettled([...jobs]);for(const deferred of deferreds)deferred.dispose();resultHandle?.dispose();if(clipboard.alive)clipboard.dispose();if(desktop.alive)desktop.dispose();vm.dispose();runtime.dispose();
 }
}

// Keep CPU-bound guest execution off the host event loop so the native stop
// listener can always deliver its abort, including during a guest infinite loop.
export async function runDesktopCode({backend,code,readOnly=true,signal,timeoutMs=30000,memoryBytes=32*1024*1024}={}) {
 if(!backend||typeof code!=='string'||Buffer.byteLength(code)>256*1024||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isInteger(memoryBytes)||memoryBytes<1024*1024||memoryBytes>64*1024*1024)throw Error('Invalid desktop sandbox request');
 signal?.throwIfAborted();
 const stopFlag=new Int32Array(new SharedArrayBuffer(4)),controller=new AbortController(),jobs=new Set();let result,failure,finished=false;
 const worker=new Worker(new URL('./desktop-code-worker.mjs',import.meta.url),{workerData:{code,readOnly,timeoutMs,memoryBytes,stopFlag:stopFlag.buffer},execArgv:[],resourceLimits:{maxOldGenerationSizeMb:128,maxYoungGenerationSizeMb:16,stackSizeMb:4}});
 let resolveDone;const done=new Promise(resolve=>{resolveDone=resolve});
 const finish=(error,value)=>{if(finished)return;finished=true;failure=error;result=value;resolveDone()};
 const abort=()=>{Atomics.store(stopFlag,0,1);controller.abort(signal?.reason||Error('Desktop run aborted'));finish(controller.signal.reason)};
 signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
 const timer=setTimeout(()=>{Atomics.store(stopFlag,0,1);controller.abort(Error('Desktop run timed out'));finish(controller.signal.reason)},timeoutMs);
 worker.on('message',message=>{
  if(finished)return;
  if(message?.type==='result'){finish(null,message.value);return}
  if(message?.type==='error'){finish(Error(message.message||'Desktop sandbox failed'));return}
  if(message?.type!=='call'||!Number.isSafeInteger(message.id)||!METHODS.includes(message.method)||!Array.isArray(message.args)||message.args.length>(message.method==='elementAt'?2:1)){finish(Error('Invalid desktop worker request'));return}
  if(readOnly&&!READONLY.has(message.method)){worker.postMessage({type:'reply',id:message.id,error:'Desktop input is read-only'});return}
  const method=message.method==='clipboard.read'?'clipboardRead':message.method==='clipboard.write'?'clipboardWrite':message.method;
  let operation;
  operation=Promise.resolve().then(()=>{controller.signal.throwIfAborted();return backend[method](...(message.args.length?message.args:[{}]),{signal:controller.signal,timeoutMs})}).then(value=>{if(!finished)worker.postMessage({type:'reply',id:message.id,value})},error=>{if(!finished)worker.postMessage({type:'reply',id:message.id,error:error?.message||'Desktop operation failed'})}).finally(()=>jobs.delete(operation));jobs.add(operation);
 });
 worker.once('error',error=>finish(error));worker.once('exit',()=>{if(!finished)finish(Error('Desktop sandbox worker exited'))});
 try{await done;if(failure)throw failure;return result}finally{
  clearTimeout(timer);signal?.removeEventListener('abort',abort);Atomics.store(stopFlag,0,1);controller.abort(Error('Desktop sandbox closed'));await Promise.allSettled([...jobs]);await worker.terminate();
 }
}
