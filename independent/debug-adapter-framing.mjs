// Independently authored from the public DAP wire specification and observable API.
export const MAX_OUTPUT_BYTES=32768;
export const MAX_ROWS=100;
const MAX_FRAME_BYTES=16*1024*1024;
const MAX_HEADER_BYTES=8192;
export function isTcpAdapterSpec(spec){
 if(typeof spec!=='string')return false;
 const separator=spec.lastIndexOf(':');
 return separator>0&&!spec.slice(0,separator).includes('/')&&/^\d+$/.test(spec.slice(separator+1));
}
export class DapFrameParser{
 #pending=Buffer.alloc(0);
 #length=null;
 push(chunk){
  if(!Buffer.isBuffer(chunk)&&!(chunk instanceof Uint8Array))throw TypeError('DAP input must be bytes');
  this.#pending=Buffer.concat([this.#pending,chunk]);
  const messages=[];
  for(;;){
   if(this.#length===null){
    const boundary=this.#pending.indexOf('\r\n\r\n');
    if(boundary<0){if(this.#pending.length>MAX_HEADER_BYTES){this.#pending=Buffer.alloc(0);throw Error('DAP header exceeds size limit');}break;}
    if(boundary>MAX_HEADER_BYTES){this.#pending=Buffer.alloc(0);throw Error('DAP header exceeds size limit');}
    const header=this.#pending.subarray(0,boundary).toString('ascii');
    this.#pending=this.#pending.subarray(boundary+4);
    const size=header.match(/(?:^|\r\n)Content-Length:\s*(\d+)\s*(?:\r\n|$)/i);
    if(!size)continue;
    const length=Number(size[1]);
    if(!Number.isSafeInteger(length)||length>MAX_FRAME_BYTES){this.#pending=Buffer.alloc(0);throw Error('DAP frame exceeds size limit');}
    this.#length=length;
   }
   if(this.#pending.length<this.#length)break;
   const content=this.#pending.subarray(0,this.#length);
   this.#pending=this.#pending.subarray(this.#length);this.#length=null;
   try{messages.push(JSON.parse(content.toString('utf8')));}catch{/* Invalid JSON is consumed; later framed messages remain readable. */}
  }
  return messages;
 }
}
