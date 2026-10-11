import {ProcessRegistry,stopOwnedGroup} from './process-registry.mjs';
import {createMonitorFilter,LineStream,MonitorBatcher} from './independent/process-streams.mjs';
import {spawn} from 'node:child_process';
import {StringDecoder} from 'node:string_decoder';
import {randomUUID} from 'node:crypto';

export function utf8Tail(text,maxBytes){const bytes=Buffer.from(text);if(bytes.length<=maxBytes)return text;let start=bytes.length-maxBytes;while(start<bytes.length&&(bytes[start]&0xc0)===0x80)start++;return bytes.subarray(start).toString('utf8')}

// Detached process groups let cleanup terminate descendants as well as the shell.
export class ProcessMonitor {
 constructor({maxBytes=256*1024,maxRecords=1000,onComplete,stateDirectory}={}){if(!Number.isInteger(maxBytes)||maxBytes<1||!Number.isInteger(maxRecords)||maxRecords<1)throw Error('Invalid ring bounds');this.registry=stateDirectory?new ProcessRegistry(stateDirectory):null;this.recovery=this.registry?.recover()||[];this.maxBytes=maxBytes;this.maxRecords=maxRecords;this.jobs=new Map();this.batchListeners=new Set();this.listeners=new Set(onComplete?[onComplete]:[])}
 onBatch(listener){this.batchListeners.add(listener);return ()=>this.batchListeners.delete(listener)}
 onComplete(listener){this.listeners.add(listener);return ()=>this.listeners.delete(listener)}
 start({command,args=[],cwd=process.cwd(),env={},shell=false,match_pattern,mode='idle',label,ownerSession}={}){
  if(typeof command!=='string'||!command.trim()||!Array.isArray(args))throw Error('command and args required');
  if(!['idle','live_safe'].includes(mode))throw Error('Invalid delivery mode');const filter=createMonitorFilter(match_pattern,{patternMaxLength:1000});if(!filter.filter)throw Error(filter.error);
  const id=randomUUID();const child=spawn(command,args,{cwd,env:{...process.env,...env,SCRUM_MONITOR_ID:id},shell,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});
  try{if(child.pid)this.registry?.save({id,pid:child.pid,token:id,hostPid:process.pid,ownerSession,created:Date.now()})}catch(error){if(child.pid){try{process.platform==='win32'?child.kill('SIGKILL'):process.kill(-child.pid,'SIGKILL')}catch{}}throw error}
  const job={id,child,pid:child.pid,status:'running',seq:0,records:[],bytes:0,exitCode:null,signal:null,mode,label,matched:[],unmatched:[],matchedBytes:0,unmatchedBytes:0,counters:{totalLines:0,matchedLines:0,unmatchedLines:0,droppedMatched:0,droppedUnmatched:0,bytesDropped:0,lastSequence:0}};this.jobs.set(job.id,job);
  const append=(stream,data)=>{const full=String(data),text=utf8Tail(full,this.maxBytes);if(text!==full)job.outputTruncated=true;const entry={seq:++job.seq,stream,text};job.records.push(entry);job.bytes+=Buffer.byteLength(text);while(job.records.length>this.maxRecords||job.bytes>this.maxBytes){job.bytes-=Buffer.byteLength(job.records.shift().text)}};
  const batcher=new MonitorBatcher({batchMaxLines:100,batchMaxBytes:32000,flushIntervalMs:250});job.batcher=batcher;
  batcher.onBatch(batch=>{const result={...batch,monitorId:job.id,id:job.id,mode:job.mode,label:job.label,stillRunning:job.status==='running'};for(const listener of this.batchListeners)Promise.resolve().then(()=>listener(result)).catch(error=>{job.notificationError=error.message})});
  const lines={stdout:new LineStream({lineMaxBytes:Math.min(this.maxBytes,64000)}),stderr:new LineStream({lineMaxBytes:Math.min(this.maxBytes,64000)})};
  const appendLines=(stream,result)=>{job.counters.bytesDropped+=result.binarySuppressedBytes;for(const line of result.lines){if(line.binary)continue;const matched=filter.filter.matches(line.text),key=matched?'matched':'unmatched',entry={seq:++job.counters.lastSequence,stream,text:line.text,...(line.truncated?{truncated:true}:{})};job.counters.totalLines++;job.counters[matched?'matchedLines':'unmatchedLines']++;job[key].push(entry);job[key+'Bytes']+=Buffer.byteLength(entry.text);while(job[key].length>this.maxRecords||job[key+'Bytes']>this.maxBytes){const removed=job[key].shift(),bytes=Buffer.byteLength(removed.text);job[key+'Bytes']-=bytes;job.counters[matched?'droppedMatched':'droppedUnmatched']++;job.counters.bytesDropped+=bytes}if(matched)batcher.push(entry)}};
  for(const stream of ['stdout','stderr'])child[stream].on('data',data=>appendLines(stream,lines[stream].feed(data)));
  const decoders={stdout:new StringDecoder('utf8'),stderr:new StringDecoder('utf8')};child.stdin.on('error',()=>{});for(const stream of ['stdout','stderr'])child[stream].on('data',d=>{const text=decoders[stream].write(d);if(text)append(stream,text)});
  job.done=new Promise(resolve=>{child.on('error',e=>{job.error=e.message;append('stderr',e.message)});child.on('close',(code,signal)=>{for(const stream of ['stdout','stderr']){const tail=decoders[stream].end();if(tail)append(stream,tail)}for(const stream of ['stdout','stderr'])appendLines(stream,lines[stream].flush());try{if(this.registry&&job.pid)this.registry.complete(job.id);else if(job.pid)stopOwnedGroup(job.pid,job.id)}catch(error){job.cleanupError=error.message}job.status=job.error?'error':'exited';batcher.flushNow();batcher.destroy();job.exitCode=code;job.signal=signal;const result=this.read(job.id);for(const listener of this.listeners)Promise.resolve().then(()=>listener(result)).catch(e=>{job.notificationError=e.message});resolve()})});
  return this.read(job.id);
 }
 get(id){const job=this.jobs.get(id);if(!job)throw Error('Unknown process');return job}
 read(id,{after=0,limit=1000,stream,since_sequence}={}){
 if(!Number.isInteger(after)||after<0||!Number.isInteger(limit)||limit<1||limit>1000||since_sequence!==undefined&&(!Number.isInteger(since_sequence)||since_sequence<0)||stream!==undefined&&!['matched','unmatched','all'].includes(stream))throw Error('Invalid output query');
 const j=this.get(id),lineQuery=stream!==undefined||since_sequence!==undefined,source=lineQuery?(stream==='matched'?j.matched:stream==='unmatched'?j.unmatched:[...j.matched,...j.unmatched].sort((a,b)=>a.seq-b.seq)):j.records,cursor=lineQuery?since_sequence??0:after;
 const records=source.filter(r=>r.seq>cursor).slice(0,limit);
 return {id,pid:j.pid,status:j.status,mode:j.mode,label:j.label,exitCode:j.exitCode,signal:j.signal,error:j.error,cleanupError:j.cleanupError,notificationError:j.notificationError,nextSeq:records.at(-1)?.seq??cursor,latestSeq:lineQuery?j.counters.lastSequence:j.seq,truncated:!!j.outputTruncated||cursor<(source[0]?.seq??1)-1,records,...(lineQuery?{lines:records}:{}),counters:{...j.counters}};
 }

 write(id,text){const j=this.get(id);if(j.status!=='running'||j.child.stdin.destroyed)throw Error('Process input closed');j.child.stdin.write(String(text));return {id,written:Buffer.byteLength(String(text))}}
 async wait(id,{timeoutMs=10000}={}){const j=this.get(id);if(!Number.isFinite(timeoutMs)||timeoutMs<0||timeoutMs>60000)throw Error('Invalid timeout');let timer;await Promise.race([j.done,new Promise(r=>{timer=setTimeout(r,timeoutMs)})]);clearTimeout(timer);return this.read(id)}
 async stop(id,{graceMs=500}={}){if(!Number.isFinite(graceMs)||graceMs<0||graceMs>10000)throw Error('Invalid grace');const j=this.get(id);const kill=signal=>{try{process.platform==='win32'?j.child.kill(signal):process.kill(-j.pid,signal)}catch(e){if(e.code!=='ESRCH')throw e}};if(j.pid&&j.status==='running'){kill('SIGTERM');await new Promise(r=>setTimeout(r,graceMs));kill('SIGKILL')}await this.wait(id,{timeoutMs:1000});return this.read(id)}
 async dispose(){await Promise.all([...this.jobs.keys()].map(id=>this.stop(id)));this.jobs.clear()}
}
