import vm from 'node:vm';
let browser,connected=false;const hostRequests=new Map();let hostSeq=0;
const host={listTools:()=>hostCall('listTools'),callTool:(name,args)=>hostCall('callTool',{name,args})};
function hostCall(method,args={}){if(!process.connected)return Promise.reject(Error('Browser host disconnected'));return new Promise((resolve,reject)=>{const hostId=++hostSeq;hostRequests.set(hostId,{resolve,reject});process.send({hostId,method,args})})}
const context=vm.createContext({console:{log(){},error(){}},setTimeout,clearTimeout,URL,Buffer});
process.on('message',async({id,action,options,code,hostId,result:hostResult,error:hostError})=>{
 if(hostId!==undefined){const pending=hostRequests.get(hostId);if(pending){hostRequests.delete(hostId);hostError?pending.reject(Error(hostError)):pending.resolve(hostResult)}return}
 try{
  let result;
  if(action==='connect'){
   if(browser)throw Error('Browser already connected');
   if(options.mode==='connected'){
    const {loadOmowright}=await import('./skills/browser/scripts/omowright.mjs');
    const {omowright}=await loadOmowright({...process.env,OMO_BROWSER_ENGINE:'connected'},host);
    let client;if(options.requestId){const {BskIpcClient}=await import('./skills/browser/runtime/omowright/index.js');const ipc=new BskIpcClient({autoStart:false});client={call:(method,params,opts)=>ipc.call(method==='session.start'?'session.start_tracked':method,method==='session.start'?{...params,request_id:options.requestId}:params,opts)};}
    browser=await omowright.connectBrowserSkill({client,name:options.name||'Scrum browser',waitForBrowserMs:0,autoStart:false,browser:options.browser_instance_id});
    connected=true;context.omowright=omowright;context.browser=browser;context.mode=options.mode;result={connected:true,mode:options.mode,sessionId:browser.sessionId};
   }else{
   const {chromium}=await import('playwright');
   if(options.mode==='owned')browser=await chromium.launch({headless:options.headless??true});
   else if(options.mode==='attached'&&options.endpoint)browser=await chromium.connectOverCDP(options.endpoint);
   else throw Error('Explicit owned or attached browser mode required');
   context.browser=browser;context.mode=options.mode;result={connected:true,mode:options.mode};}
  }else if(action==='execute'){
   if(!browser)throw Error('Browser is not connected');
   result=await new vm.Script(`(async()=>{${code}\n})()`).runInContext(context,{timeout:10000});
  }else if(action==='close'){if(browser)await (connected?browser.stop():browser.close());browser=undefined;result={closed:true}}
  else throw Error('Unknown browser action');
  if(Buffer.isBuffer(result)){const format=result.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'png':result[0]===0xff&&result[1]===0xd8?'jpeg':null;if(format)result={buffer:result,format};}
  if(Buffer.isBuffer(result?.buffer)){const {buffer,...metadata}=result;result={metadata,__scrumImage:{data:buffer.toString('base64'),mediaType:metadata.format==='jpeg'?'image/jpeg':'image/png'}}}
  if(process.connected)process.send({id,result});
 }catch(e){if(process.connected)process.send({id,error:e.message})}
});

process.once('disconnect',()=>{for(const row of hostRequests.values())row.reject(Error('Browser host disconnected'));hostRequests.clear();const timer=setTimeout(()=>process.exit(1),5000);Promise.resolve().then(()=>browser&&(connected?browser.stop():browser.close())).catch(()=>{}).finally(()=>{clearTimeout(timer);process.exit(0)})});
