import {randomUUID} from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, isAbsolute } from 'node:path';

const MAX_JSON = 4 * 1024 * 1024;
export function runDesktopCommand(executable, args, {signal, timeoutMs=30000, maxBytes=MAX_JSON, guardianExecutable}={}) {
  if (!isAbsolute(executable) || !Array.isArray(args) || args.some(arg => typeof arg !== 'string')) throw Error('Invalid desktop command');
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 60000) throw Error('Invalid desktop timeout');
  if(guardianExecutable!==undefined&&(typeof guardianExecutable!=='string'||!isAbsolute(guardianExecutable)))throw Error('Invalid desktop command guardian');
  signal?.throwIfAborted();
  return new Promise((resolve,reject) => {
    const child=spawn(guardianExecutable||executable,guardianExecutable?[executable,String(timeoutMs),...args]:args,{stdio:guardianExecutable?['pipe','pipe','pipe','pipe']:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
    const chunks=[]; let size=0, failure, killTimer,ownedGroup,control='';
    const kill=()=>{if(ownedGroup)try{process.kill(-ownedGroup,'SIGTERM')}catch{};try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGTERM')}catch{}}
    const stop=reason=>{if(failure)return;failure=reason;kill();killTimer=setTimeout(()=>{if(ownedGroup)try{process.kill(-ownedGroup,'SIGKILL')}catch{};try{process.kill(process.platform==='win32'?child.pid:-child.pid,'SIGKILL')}catch{}},guardianExecutable?500:250);killTimer.unref?.()};
    const abort=()=>stop(signal.reason||Error('Desktop command aborted'));
    const timer=setTimeout(()=>stop(Error('Desktop command timed out')),timeoutMs);
    signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
    if(guardianExecutable)child.stdio[3].on('data',bytes=>{control+=bytes.toString('utf8');if(control.length>32)return stop(Error('Invalid desktop guardian response'));if(control.includes('\n')){if(!/^[1-9][0-9]*\n$/.test(control))return stop(Error('Invalid desktop guardian response'));const pid=Number(control.trim());if(!Number.isSafeInteger(pid)||pid<=1||pid>2147483647)return stop(Error('Invalid desktop guardian process'));ownedGroup=pid;if(failure)kill();}});
    child.stdout.on('data',bytes=>{size+=bytes.length;if(size>maxBytes)stop(Error('Desktop response exceeds limit'));else chunks.push(bytes)});
    // Do not retain stderr: input may contain passwords or other confidential text.
    child.stderr.resume();
    child.on('error',error=>{failure??=error});
    child.on('close',code=>{clearTimeout(timer);clearTimeout(killTimer);signal?.removeEventListener('abort',abort);if(failure)reject(failure);else if(code!==0){const error=Error(`Desktop command exited with status ${code}`);Object.defineProperty(error,'desktopOutput',{value:Buffer.concat(chunks).toString('utf8')});reject(error)}else resolve(Buffer.concat(chunks).toString('utf8'))});
  });
}
const coordinate=value=>{if(!Number.isFinite(value)||Math.abs(value)>100000)throw Error('Invalid desktop coordinate');return String(value)};
export class PeekabooDesktop {
  constructor({executable,observerExecutable,guardianExecutable,authorizeInput,stopStatus,runner=runDesktopCommand}={}) {
    if(typeof executable!=='string'||!isAbsolute(executable))throw Error('Absolute Peekaboo executable required');
    if(observerExecutable!==undefined&&(typeof observerExecutable!=='string'||!isAbsolute(observerExecutable)))throw Error('Absolute desktop observer executable required');
    if(guardianExecutable!==undefined&&(typeof guardianExecutable!=='string'||!isAbsolute(guardianExecutable)))throw Error('Absolute desktop command guardian required');
    this.executable=executable;this.observerExecutable=observerExecutable;this.guardianExecutable=guardianExecutable;this.authorizeInput=authorizeInput;this.stopStatus=stopStatus;this.runner=runner;this.frames=new Map();
  }
  async command(args,options={}) {
    let text;
    try{text=await this.runner(this.executable,[...args,'--no-remote','--json'],{...options,guardianExecutable:this.guardianExecutable})}catch(error){
      if(typeof error.desktopOutput!=='string')throw error;
      try{const receipt=JSON.parse(error.desktopOutput);if(receipt?.success!==false)throw error;text=error.desktopOutput}catch{throw error}
    }
    let response;try{response=JSON.parse(text)}catch{throw Error('Invalid Peekaboo JSON response')}
    if(response?.success!==true){const error=Error('Peekaboo rejected desktop operation');error.notDispatched=response?.error?.mutation_dispatched===false&&response?.error?.retry_safe===true;throw error}
    return response.data;
  }
  async guardedMutation(operation){
    try{return await operation()}catch(error){
      const result=Error(error.notDispatched?'Desktop input was not dispatched':'Desktop input outcome is uncertain; verify target state before retry',{cause:error});
      result.notDispatched=error.notDispatched===true;throw result;
    }
  }
  mutateNative(kind,request,options){return this.guardedMutation(()=>this.nativeRequest(kind,request,options))}
  async nativeRequest(kind,request,options){
    const bytes=Buffer.from(JSON.stringify(request));if(bytes.length>65536)throw Error('Desktop AX request exceeds limit');
    return this.observe(kind,options,[bytes.toString('base64')]);
  }
  scopedRequest(request,allowed){
    if(!request||typeof request!=='object'||Array.isArray(request)||typeof request.method!=='string'||!allowed.includes(request.method)||!Array.isArray(request.args)||request.args.length>2)throw Error('Invalid scoped desktop operation');
    return request;
  }
  async windowRead(request,options){
    const {id,method,args}=this.scopedRequest(request,['screenshot','ax','find','ref']);
    if(typeof id!=='string'||!id)throw Error('Invalid desktop window ID');await this.window(id,options);
    if(method==='screenshot'){if(args.length>1||args[0]!==undefined&&(!args[0]||typeof args[0]!=='object'||Array.isArray(args[0])))throw Error('Invalid scoped screenshot');const capture=await this.screenshot({...args[0],windowId:id},options);return {...capture,target:id}}
    if(method==='ref'){if(args.length!==1||typeof args[0]!=='string')throw Error('Invalid desktop ref');return this.nativeRequest('window-operation',{id,operation:'ref',ref:args[0]},options)}
    if(args.length>1||args[0]!==undefined&&(!args[0]||typeof args[0]!=='object'||Array.isArray(args[0])))throw Error('Invalid desktop AX query');
    return this.nativeRequest('window-operation',{id,operation:method,...(method==='find'?{query:args[0]||{}}:{limit:args[0]?.limit,maxDepth:args[0]?.maxDepth})},options);
  }
  async windowInput(request,options){
    const {id,method,args}=this.scopedRequest(request,['raise','click','doubleClick','move','drag','scroll','type','press']);
    if(typeof id!=='string'||!id)throw Error('Invalid desktop window ID');await this.window(id,options);
    if(method==='raise'){if(args.length)throw Error('Window raise takes no arguments');await this.authorizeInput?.();if(typeof this.authorizeInput!=='function')throw Error('Desktop ownership required');options?.signal?.throwIfAborted();return this.mutateNative('window-operation',{id,operation:'raise'},options)}
    let frame=[...this.frames.entries()].reverse().find(([,value])=>value.windowId===id&&Date.now()-value.createdAt<60000);
    if(!frame){const capture=await this.screenshot({windowId:id},options);frame=[capture.frameId,this.frames.get(capture.frameId)]}
    const frameId=frame[0];let value;
    if(['click','doubleClick','move'].includes(method)&&args.length===2)value={x:args[0],y:args[1]};
    else if(args.length!==1)throw Error('Invalid scoped input arguments');else value=args[0];
    if(method==='type')value=typeof value==='string'?{text:value}:value;
    if(method==='press')value=typeof value==='string'||Array.isArray(value)?{keys:value}:value;
    if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid scoped input');
    return this[method]({...value,frameId},options);
  }
  async elementRead(request,options){
    const {ref,method,args}=this.scopedRequest(request,['value','bounds','attributes','actions','parent','children','window']);
    if(typeof ref!=='string'||!ref.startsWith('scrum-ax:')||args.length)throw Error('Invalid desktop element request');
    return this.nativeRequest('element-operation',{ref,operation:method},options);
  }
  async elementInput(request,options){
    const {ref,method,args}=this.scopedRequest(request,['setValue','perform','press','click','focus']);
    if(typeof ref!=='string'||!ref.startsWith('scrum-ax:'))throw Error('Invalid desktop element ref');
    if(typeof this.authorizeInput!=='function')throw Error('Desktop ownership required');await this.authorizeInput();options?.signal?.throwIfAborted();
    if(method==='setValue'){if(args.length!==1||!['string','boolean','number'].includes(typeof args[0])||typeof args[0]==='number'&&!Number.isFinite(args[0]))throw Error('Invalid AX value');return this.mutateNative('element-operation',{ref,operation:method,value:args[0]},options)}
    if(method==='perform'){if(args.length!==1||typeof args[0]!=='string'||args[0].length>256)throw Error('Invalid AX action');return this.mutateNative('element-operation',{ref,operation:method,action:args[0]},options)}
    if(args.length)throw Error('Element operation takes no arguments');
    if(method==='focus')return this.mutateNative('element-operation',{ref,operation:'focus'},options);
    const actions=await this.elementRead({ref,method:'actions',args:[]},options);
    if(method==='press'||actions.includes('AXPress'))return this.mutateNative('element-operation',{ref,operation:'perform',action:'AXPress'},options);
    const bounds=await this.elementRead({ref,method:'bounds',args:[]},options);
    const windowId=await this.elementRead({ref,method:'window',args:[]},options),window=await this.window(windowId,options),capture=await this.screenshot({windowId},options);
    return this.click({x:(bounds.x+bounds.width/2-window.bounds.x)*capture.width/window.bounds.width,y:(bounds.y+bounds.height/2-window.bounds.y)*capture.height/window.bounds.height,frameId:capture.frameId},options);
  }
  permissions(options){return this.command(['permissions','status'],options)}
  async observe(method,options={},args=[]) {
    if(!this.observerExecutable)throw Error('Native desktop observer unavailable');
    let value;try{value=JSON.parse(await this.runner(this.observerExecutable,[method,...args],{...options,guardianExecutable:this.guardianExecutable}))}catch(error){throw Error('Native desktop observation failed',{cause:error})}
    if(value?.error)throw Error('Native desktop observation refused');return value;
  }
  async capabilities(_,options){const permissions=await this.observe('permissions',options),displays=await this.displays({},options),stop=this.stopStatus?.();return {backend:'quartz',displayServer:'Quartz WindowServer',capture:permissions.capture===true,input:permissions.input===true,ax:permissions.ax===true,backgroundWindowInput:true,deliveryModes:['foreground','background-window'],capturePermission:permissions.capture?'granted':'denied',inputPermission:permissions.input?'granted':'denied',axPermission:permissions.ax?'granted':'denied',displayCount:displays.length,focusGuard:false,stopPath:stop?(stop.globalLive?'native-global-hotkey':'unavailable'):'unconnected',stopReason:stop?(stop.suspended?'human-resume-required':stop.reason||null):'Session controller must verify native stop',integrityLevel:null,screenLocked:null}}
  displays(_,options){return this.observe('displays',options)}
  windows(_,options){return this.observe('windows',options)}
  focusedElement(_,options){return this.observe('focused-element',options)}
  elementAt(x,y,options){return this.observe('element-at',options,[coordinate(x),coordinate(y)])}
  ref(token,options){if(typeof token!=='string'||!token.startsWith('scrum-ax:')||token.length>16384)throw Error('Invalid desktop element ref');return this.observe('ref',options,[token])}
  clipboardRead(_,options){return this.observe('clipboard-read',options)}
  async clipboardWrite(text,options){if(typeof text!=='string'||Buffer.byteLength(text)>65536)throw Error('Invalid clipboard text');if(typeof this.authorizeInput!=='function')throw Error('Clipboard write requires desktop ownership and live emergency stop');await this.authorizeInput();options?.signal?.throwIfAborted();return this.guardedMutation(()=>this.observe('clipboard-write',options,[Buffer.from(text,'utf8').toString('base64')]))}
  focusedWindow(_,options){return this.observe('focused-window',options)}
  async window(selector,options){
    if(typeof selector!=='string'&&(!selector||typeof selector!=='object'||Array.isArray(selector)))throw Error('Invalid desktop window selector');
    const rows=await this.windows({},options);
    const matches=rows.filter(row=>typeof selector==='string'?(row.id===selector||row.title===selector||row.app===selector):Object.entries(selector).every(([key,value])=>['id','title','app','pid'].includes(key)&&row[key]===value));
    if(matches.length!==1)throw Error(matches.length?'Ambiguous desktop window selector':'Desktop window not found');
    const row=matches[0];return {id:row.id,app:row.app,title:row.title,pid:row.pid,bounds:{x:row.x,y:row.y,width:row.width,height:row.height},focused:row.focused};
  }

  async screenshot({target='desktop',windowId,screenIndex=0,maxWidth=1600,maxHeight=1200,maxBytes=8*1024*1024,...options}={},runOptions={}) {
    options={...options,...runOptions};
    if(!['desktop','window'].includes(target))throw Error('Invalid desktop capture target');if(target==='window'&&windowId===undefined)throw Error('Window capture requires a window ID');
    if(windowId!==undefined){windowId=String(windowId);if(!/^[1-9][0-9]*$/.test(windowId))throw Error('Invalid desktop window ID');target='window'}
    if(!Number.isSafeInteger(screenIndex)||screenIndex<0||!Number.isSafeInteger(maxWidth)||maxWidth<1||maxWidth>1600||!Number.isSafeInteger(maxHeight)||maxHeight<1||maxHeight>1200||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>8*1024*1024)throw Error('Invalid desktop capture limits');
    const directory=await mkdtemp(join(tmpdir(),'scrum-desktop-'));const path=join(directory,'capture.png');
    try{
      let screen,receipt;
      if(target==='window'){
       const window=await this.window(windowId,options);screen={bounds:window.bounds};
       receipt=await this.command(['see','--mode','window','--window-id',windowId,'--no-elements','--format','png','--path',path],options);
       if(typeof receipt?.snapshot_id!=='string'||!receipt.snapshot_id)throw Error('Window capture has no target receipt');
      }else{
       const inventory=await this.command(['screen','list'],options);screen=inventory?.screens?.find(item=>item.index===screenIndex);
       if(!screen||!Number.isFinite(screen.bounds?.x)||!Number.isFinite(screen.bounds?.y)||!(screen.bounds?.width>0)||!(screen.bounds?.height>0))throw Error('Desktop display not found');
       receipt=await this.command(['see','--mode','screen','--screen-index',String(screenIndex),'--no-elements','--format','png','--path',path],options);
      }
      const handle=await open(path,'r'),header=Buffer.alloc(24);try{const read=await handle.read(header,0,24,0);if(read.bytesRead!==24)throw Error('Invalid desktop capture header')}finally{await handle.close()}
      if(!header.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||header.toString('ascii',12,16)!=='IHDR')throw Error('Desktop capture is not PNG');
      const sourceWidth=header.readUInt32BE(16),sourceHeight=header.readUInt32BE(20);if(!sourceWidth||!sourceHeight||sourceWidth>32768||sourceHeight>32768)throw Error('Invalid desktop source dimensions');
      const scale=Math.min(1,maxWidth/sourceWidth,maxHeight/sourceHeight),desiredWidth=Math.max(1,Math.floor(sourceWidth*scale)),desiredHeight=Math.max(1,Math.floor(sourceHeight*scale));
      await this.runner('/usr/bin/sips',['--resampleHeightWidth',String(desiredHeight),String(desiredWidth),path],{...options,maxBytes:16384,guardianExecutable:this.guardianExecutable});
      const info=await stat(path);if(!info.isFile()||info.size>maxBytes||info.size<24)throw Error('Desktop capture exceeds limit');
      const bytes=await readFile(path);
      if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw Error('Desktop capture is not PNG');
      const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
      if(!width||!height||width>maxWidth||height>maxHeight)throw Error('Desktop capture dimensions exceed limits');
      const frameId=randomUUID(),actualScale=width/sourceWidth;
      for(const [id,frame]of this.frames)if(Date.now()-frame.createdAt>60000)this.frames.delete(id);
      this.frames.set(frameId,{width,height,scale:actualScale,screenIndex,displayID:screen.displayID,windowId,snapshotId:receipt?.snapshot_id,bounds:screen.bounds,createdAt:Date.now()});
      return {target:target==='window'?`window:${windowId}`:'desktop',frameId,width,height,sourceWidth,sourceHeight,scale:actualScale,mimeType:'image/png',data:bytes.toString('base64'),receipt};
    }finally{await rm(directory,{recursive:true,force:true})}
  }
  async input(args,options,{foreground=true}={}){
    if(typeof this.authorizeInput!=='function')throw Error('Desktop input requires ownership and live emergency stop');
    await this.authorizeInput();options?.signal?.throwIfAborted();
    return this.guardedMutation(()=>this.command([...args,...(foreground?['--foreground']:[])],options));
  }
  async point({x,y,frameId},options,{globalCoordinates=false}={}){
    coordinate(x);coordinate(y);if(frameId===undefined)return `${x},${y}`;
    const frame=this.frames.get(frameId);if(!frame||Date.now()-frame.createdAt>60000)throw Error('Stale desktop frame; capture again');
    if(x<0||y<0||x>=frame.width||y>=frame.height)throw Error('Desktop point is outside the captured frame');
    if(frame.windowId){
     const window=await this.window(frame.windowId,options);
     if(['x','y','width','height'].some(key=>window.bounds[key]!==frame.bounds[key]))throw Error('Desktop window changed; capture again');
     return `${(globalCoordinates?frame.bounds.x:0)+x*frame.bounds.width/frame.width},${(globalCoordinates?frame.bounds.y:0)+y*frame.bounds.height/frame.height}`;
    }
    const inventory=await this.command(['screen','list'],options),screen=inventory?.screens?.find(item=>item.displayID===frame.displayID);
    if(!screen||['x','y','width','height'].some(key=>screen.bounds?.[key]!==frame.bounds[key]))throw Error('Desktop display changed; capture again');
    return `${frame.bounds.x+x*frame.bounds.width/frame.width},${frame.bounds.y+y*frame.bounds.height/frame.height}`;
  }

  async click({x,y,frameId,button='left',count=1},options){
    if(!['left','right','middle'].includes(button)||![1,2,3].includes(count))throw Error('Invalid desktop click');
    if(button!=='left'&&count!==1)throw Error('Unsupported desktop click combination');
    const point=await this.point({x,y,frameId},options),frame=this.frames.get(frameId),background=Boolean(frame?.windowId);
    return this.input(['click','--at',point,...(background?['--window-id',frame.windowId,'--snapshot',frame.snapshotId]:['--global']),...(button==='left'?[]:[`--${button}`]),...(count===1?[]:[count===2?'--double':'--triple'])],options,{foreground:!background});
  }
  doubleClick(args,options){return this.click({...args,count:2},options)}
  async move({x,y,frameId},options){return this.input(['move','--at',await this.point({x,y,frameId},options,{globalCoordinates:true}),'--global'],options)}
  async keyboardTarget(frameId,options){
    if(frameId!==undefined){
     const frame=this.frames.get(frameId);if(!frame||Date.now()-frame.createdAt>60000)throw Error('Stale desktop frame; capture again');
     if(frame.windowId){const window=await this.window(frame.windowId,options);if(['x','y','width','height'].some(key=>window.bounds[key]!==frame.bounds[key]))throw Error('Desktop window changed; capture again');return {args:['--window-id',frame.windowId,'--snapshot',frame.snapshotId],foreground:false}}
    }
    if(this.observerExecutable){const window=await this.focusedWindow({},options);return {args:['--window-id',window.id],foreground:true}}
    return {args:[],foreground:true};
  }
  async type(value,options){const {text,frameId,clear=false}=typeof value==='string'?{text:value}:value||{};if(typeof text!=='string'||Buffer.byteLength(text)>65536||text.includes('\0')||typeof clear!=='boolean')throw Error('Invalid desktop text');const target=await this.keyboardTarget(frameId,options);return this.input(['type','--text='+text.replace(/\\/g,'\\\\'),...(clear?['--clear']:[]),...target.args],options,target)}
  async press(value,options){const {keys,frameId}=typeof value==='string'?{keys:value}:value||{},chords=Array.isArray(keys)?keys:[keys];if(!chords.length||chords.length>1000||chords.some(key=>typeof key!=='string'||!key||key.length>200||key.startsWith('-')||/[\s\0]/.test(key)))throw Error('Invalid desktop key chord');const target=await this.keyboardTarget(frameId,options);return this.input(['press',...chords,...target.args],options,target)}
  async scroll({direction,amount=1,frameId,x,y},options){
    if(!['up','down','left','right'].includes(direction)||!Number.isInteger(amount)||amount<1||amount>1000)throw Error('Invalid desktop scroll');
    const target=await this.keyboardTarget(frameId,options),frame=this.frames.get(frameId),point=frame?.windowId?await this.point({x:x??frame.width/2,y:y??frame.height/2,frameId},options):undefined;
    return this.input(['scroll','--direction',direction,'--amount',String(amount),...target.args,...(point?['--at',point]:[])],options,target);
  }
  async drag({from,to,frameId,durationMs=500},options){if(!Number.isInteger(durationMs)||durationMs<1||durationMs>10000)throw Error('Invalid desktop drag duration');const frame=this.frames.get(frameId),target=frame?.windowId?{args:['--snapshot',frame.snapshotId],foreground:false}:{args:[],foreground:true};return this.input(['drag','--from',await this.point({...from,frameId},options,{globalCoordinates:true}),'--to',await this.point({...to,frameId},options,{globalCoordinates:true}),'--duration',`${durationMs}ms`,...target.args],options,target)}
}
