import {createServer,createConnection} from 'node:net';
import {chmod,unlink,mkdtemp,rmdir} from 'node:fs/promises';
import {join} from 'node:path';
import {randomBytes,timingSafeEqual} from 'node:crypto';
export async function serve(path,handler){
 const temporary=Buffer.byteLength(path)>90?await mkdtemp('/tmp/scrum-'):null;
 if(temporary){await chmod(temporary,0o700);path=join(temporary,'rpc.sock')}
 const token=randomBytes(32).toString('hex'),bindings=new Map([[token,null]]),workers=new Map();
 const issue=binding=>{if(workers.has(binding.runId))bindings.delete(workers.get(binding.runId));const child=randomBytes(32).toString('hex');workers.set(binding.runId,child);bindings.set(child,{...binding});return {path,token:child}};
 try{await unlink(path)}catch(error){if(error.code!=='ENOENT')throw error}
 const server=createServer(socket=>{
  let input='',received=false;socket.setTimeout(15000,()=>socket.destroy());
  socket.setEncoding('utf8');socket.on('error',()=>{});socket.on('data',chunk=>{
   if(received)return;input+=chunk;if(Buffer.byteLength(input)>1000000){socket.destroy();return}if(!input.includes('\n'))return;received=true;socket.setTimeout(0);
   void (async()=>{try{
    const request=JSON.parse(input.slice(0,input.indexOf('\n'))),provided=Buffer.from(request.token||'');
    const accepted=[...bindings.keys()].find(key=>provided.length===key.length&&timingSafeEqual(provided,Buffer.from(key)));if(!accepted)throw Error('Scrum接続権限がありません');
    const binding=bindings.get(accepted);delete request.callerSession;if(binding){request.parentSession=binding.parentSession;request.callerSession=binding.runId;}
    const data=await handler(request);socket.end(JSON.stringify({success:true,data})+'\n');
   }catch(error){socket.end(JSON.stringify({success:false,error:error.message})+'\n')}})();
  });
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(path,resolve)});await chmod(path,0o600);
 return {path,token,issue,revoke:child=>bindings.delete(child),close:async()=>{await new Promise(resolve=>server.close(resolve));await unlink(path).catch(()=>{});if(temporary)await rmdir(temporary)}};
}
export function request(path,token,method,args={},parentSession){
 return new Promise((resolve,reject)=>{
  const timeout=method==='task'&&args.run_in_background===false?Math.max(10000,Math.min(3600000,args.timeout_ms||300000)+30000):10000;
  const socket=createConnection(path),timer=setTimeout(()=>{socket.destroy();reject(Error('Scrum接続がタイムアウトしました'))},timeout);let input='',received=false;
  socket.setEncoding('utf8');socket.once('error',reject);socket.once('connect',()=>socket.write(JSON.stringify({token,method,args,parentSession})+'\n'));
  socket.on('data',chunk=>{input+=chunk;if(Buffer.byteLength(input)>1000000){socket.destroy();reject(Error('Scrumの応答が大きすぎます'));return}if(!input.includes('\n'))return;received=true;try{const response=JSON.parse(input.slice(0,input.indexOf('\n')));response.success?resolve(response.data):reject(Error(response.error))}catch(error){reject(error)}socket.end()});
  socket.once('close',()=>{clearTimeout(timer);if(!received)reject(Error('Scrum接続が応答前に終了しました'))});
 });
}
