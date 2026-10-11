import {createHash,randomUUID} from 'node:crypto';
import {open,mkdir,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {join} from 'node:path';
import {DesktopLease} from '../desktop-lease.mjs';
import {NativeDesktopStop} from './desktop-native-stop.mjs';
import {PeekabooDesktop} from './desktop-peekaboo.mjs';
import {loadNativeDesktopBuild,peekabooExecutable} from './desktop-build-loader.mjs';
import {runDesktopCode} from './desktop-code.mjs';
const stopped=new Set();
export class IndependentDesktopSessions {
 constructor({peekabooPath,observerPath,stopPath,guardianPath,stopFactory,backendFactory,runCode=runDesktopCode,...leaseOptions}={}){
  this.sessions=new Map();this.lease=new DesktopLease(leaseOptions);this.options={peekabooPath,observerPath,stopPath,guardianPath,stopFactory,backendFactory,runCode};
 }
 get(session){const row=this.sessions.get(session);if(!row||!row.ready||row.closing)throw Error('Desktop session is not open');return row}
 async paths(){
  const options=this.options;if(options.stopPath&&options.observerPath)return {stop:options.stopPath,observe:options.observerPath,guardian:options.guardianPath,peekaboo:options.peekabooPath||peekabooExecutable()};
  const build=await loadNativeDesktopBuild();return {...build,peekaboo:options.peekabooPath||peekabooExecutable()};
 }
 makeStop(row,executable){
  const options={executable,onStop:status=>{if(status.suspended||!status.globalLive){stopped.add(row.session);row.suspended=true;row.controller?.abort(Error('Desktop emergency stop'))}}};
  return this.options.stopFactory?this.options.stopFactory(options):new NativeDesktopStop(options);
 }
 async audit(row,event,extra={}){
  if(!row.auditPath)return;
  const handle=await open(row.auditPath,constants.O_WRONLY|constants.O_CREAT|constants.O_APPEND|constants.O_NOFOLLOW,0o600);
  try{if(!(await handle.stat()).isFile())throw Error('Desktop audit must be a regular file');await handle.writeFile(JSON.stringify({version:1,session:row.session,event,time:new Date().toISOString(),...extra})+'\n');await handle.sync()}finally{await handle.close()}
 }
 async open(session,{cwd=process.cwd(),artifactDir,auditPath}={}){
  if(typeof session!=='string'||!session||this.sessions.has(session))throw Error('Unique session required');
  const row={session,cwd,artifactDir,auditPath,ready:false,closing:false,suspended:stopped.has(session),controller:null,running:null,openController:new AbortController()};this.sessions.set(session,row);
  const opening=(async()=>{try{
   const paths=await this.paths();if(row.closing)throw Error('Desktop session closed during startup');row.stopPath=paths.stop;row.stop=this.makeStop(row,paths.stop);await row.stop.open();if(row.closing)throw Error('Desktop session closed during startup');
   const authorizeInput=()=>{if(row.closing||row.suspended||stopped.has(session))throw Error('Desktop suspended; explicit human resume required');this.lease.assert(session);row.stop.assertLive()};
   const options={executable:paths.peekaboo,observerExecutable:paths.observe,guardianExecutable:paths.guardian,authorizeInput,stopStatus:()=>({...row.stop.status,suspended:row.suspended||row.stop.status.suspended})};row.backend=this.options.backendFactory?this.options.backendFactory(options):new PeekabooDesktop(options);
   const capabilities=await row.backend.capabilities({},{signal:row.openController.signal});if(row.closing)throw Error('Desktop session closed during startup');row.capabilities=capabilities;await this.audit(row,'open');if(row.closing)throw Error('Desktop session closed during startup');row.ready=true;return {...capabilities,stopPath:row.stop.status.globalLive?'native-global-hotkey':'unavailable',stopReason:row.suspended?'human-resume-required':row.stop.status.reason||null};
  }catch(error){await row.stop?.close();if(this.sessions.get(session)===row)this.sessions.delete(session);throw error}})();row.opening=opening;return opening;
 }
 acquire(session){const row=this.get(session);if(row.suspended||stopped.has(session))throw Error('Desktop suspended; explicit human resume required');row.stop.assertLive();return this.lease.acquire(session)}
 release(session){const row=this.sessions.get(session);if(row?.running)throw Error('Cannot release desktop ownership during active input');return this.lease.release(session)}
 recoverLease(options){return this.lease.recover(options)}
 async run(session,code,{readOnly=true,signal,timeoutMs=30000}={}){
  const row=this.get(session);if(typeof code!=='string'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000)throw Error('Invalid desktop run');if(row.running)throw Error('Desktop run already active');
  if(!readOnly){if(row.suspended||stopped.has(session))throw Error('Desktop suspended; explicit human resume required');this.lease.assert(session);row.stop.assertLive()}
  const controller=new AbortController();row.controller=controller;const abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
  const codeSha256=createHash('sha256').update(code).digest('hex');
  const operation=Promise.resolve().then(async()=>{
   controller.signal.throwIfAborted();await this.audit(row,'run-start',{codeSha256,readOnly});
   const result=await this.options.runCode({backend:row.backend,code,readOnly,signal:controller.signal,timeoutMs});
   if(row.artifactDir){await mkdir(row.artifactDir,{recursive:true});for(const image of result.displays.filter(value=>value.type==='image')){const path=join(row.artifactDir,`${randomUUID()}.png`);await writeFile(path,Buffer.from(image.data,'base64'),{flag:'wx',mode:0o600})}}
   await this.audit(row,'run-complete',{codeSha256,imageCount:result.displays.length});return {content:result.displays,details:result};
  }).catch(async error=>{await this.audit(row,'run-failed',{codeSha256,aborted:controller.signal.aborted});throw error}).finally(()=>{signal?.removeEventListener('abort',abort);row.controller=null;row.running=null});
  row.running=operation;return operation;
 }
 screenshot(session){return this.run(session,'return await desktop.screenshot()')}
 async emergencyAbort(session){const row=this.get(session);stopped.add(session);row.suspended=true;row.controller?.abort(Error('Desktop emergency stop'));await row.running?.catch(()=>{});this.lease.release(session);await this.audit(row,'stop');return {globalLive:row.stop.status.globalLive,suspended:true}}
 async resume(session,{humanRequested=false}={}){
  if(!humanRequested)throw Error('Only explicit human request can resume desktop input');const row=this.get(session);if(row.running)throw Error('Desktop run must finish before resume');await row.stop.close();if(row.closing)throw Error('Desktop session closed during resume');row.stop=this.makeStop(row,row.stopPath);await row.stop.open();if(row.closing)throw Error('Desktop session closed during resume');row.stop.assertLive();row.suspended=false;stopped.delete(session);await this.audit(row,'resume');return {globalLive:true,suspended:false};
 }
 async close(session){const row=this.sessions.get(session);if(!row)return;if(row.closing)return row.closePromise;row.closing=true;row.openController?.abort(Error('Desktop session closed'));row.closePromise=(async()=>{row.controller?.abort(Error('Desktop session closed'));await row.opening?.catch(()=>{});await row.running?.catch(()=>{});try{await row.stop?.close();await this.audit(row,'close')}finally{this.lease.release(session);if(this.sessions.get(session)===row)this.sessions.delete(session)}})();return row.closePromise}
 async dispose(){await Promise.all([...this.sessions.keys()].map(session=>this.close(session)))}
}
