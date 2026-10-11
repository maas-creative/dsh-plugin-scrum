import {StringDecoder} from 'node:string_decoder';
import {stripVTControlCharacters} from 'node:util';

export function createMonitorFilter(pattern,{patternMaxLength=1000}={}) {
 if(pattern===undefined||pattern===null||pattern==='')return {filter:{matches:()=>true}};
 if(typeof pattern!=='string'||pattern.length>patternMaxLength)return {error:'Invalid monitor pattern length'};
 // Reject repeated quantified groups, preserving the existing pattern contract.
 // This static guard is not a proof that every accepted expression is linear.
 if(/\([^)]*[*+{][^)]*\)[*+{]/.test(pattern))return {error:'unsafe monitor regex'};
 try{const regex=new RegExp(pattern);return {filter:{matches:text=>regex.test(text)}}}catch(error){return {error:'invalid regex: '+error.message}}
}

export class LineStream {
 constructor({lineMaxBytes=64000}={}){if(!Number.isSafeInteger(lineMaxBytes)||lineMaxBytes<1)throw Error('Invalid line byte limit');this.limit=lineMaxBytes;this.decoder=new StringDecoder('utf8');this.reset();}
 reset(){this.text='';this.bytes=0;this.total=0;this.emitted=false;this.binary=false;}
 consume(text,final=false){const lines=[];let binarySuppressedBytes=0;
  for(const character of text){
   const size=Buffer.byteLength(character);this.total+=size;
   if(character==='\0')this.binary=true;
   if(character==='\n'){
    if(this.binary){lines.push({text:'',rawText:'',binary:true});binarySuppressedBytes+=this.total;}
    else if(!this.emitted){const rawText=this.text.replace(/\r$/,'');lines.push({text:stripVTControlCharacters(rawText),rawText});}
    this.reset();continue;
   }
   if(this.binary||this.emitted)continue;
   if(this.bytes+size>this.limit){const rawText=this.text;lines.push({text:stripVTControlCharacters(rawText),rawText,truncated:true});this.emitted=true;continue;}
   this.text+=character;this.bytes+=size;
  }
  if(final){if(this.binary){lines.push({text:'',rawText:'',binary:true});binarySuppressedBytes+=this.total;}else if(!this.emitted&&this.text){const rawText=this.text.replace(/\r$/,'');lines.push({text:stripVTControlCharacters(rawText),rawText});}this.reset();}
  return {lines,binarySuppressedBytes};
 }
 feed(bytes){return this.consume(this.decoder.write(bytes));}
 flush(){return this.consume(this.decoder.end(),true);}
}

export class MonitorBatcher {
 constructor({batchMaxLines=100,batchMaxBytes=32000,flushIntervalMs=250,monitorId=''}={}){
  if(!Number.isSafeInteger(batchMaxLines)||batchMaxLines<1||!Number.isSafeInteger(batchMaxBytes)||batchMaxBytes<1||!Number.isFinite(flushIntervalMs)||flushIntervalMs<1)throw Error('Invalid monitor batch limits');
  this.maxLines=batchMaxLines;this.maxBytes=batchMaxBytes;this.interval=flushIntervalMs;this.monitorId=monitorId;this.lines=[];this.bytes=0;this.sequence=0;this.listeners=new Set();this.closed=false;
 }
 onBatch(listener){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 pendingCount(){return this.lines.length;}
 push(line){if(this.closed)return;const size=Buffer.byteLength(line.text);if(this.lines.length&&(this.bytes+size>this.maxBytes||this.lines.length>=this.maxLines))this.flushNow();this.lines.push({...line});this.bytes+=size;if(this.lines.length>=this.maxLines||this.bytes>=this.maxBytes)this.flushNow();else this.startTimer();}
 startTimer(){if(!this.timer&&!this.closed){this.timer=setTimeout(()=>this.flushNow(),this.interval);this.timer.unref?.();}}
 clearTimer(){clearTimeout(this.timer);this.timer=null;}
 flushNow(){this.clearTimer();if(!this.lines.length)return;const batch={monitorId:this.monitorId,batchSeq:++this.sequence,lines:this.lines,stillRunning:true};this.lines=[];this.bytes=0;for(const listener of this.listeners)listener(batch);}
 destroy(){this.clearTimer();this.closed=true;this.lines=[];this.bytes=0;this.listeners.clear();}
}
