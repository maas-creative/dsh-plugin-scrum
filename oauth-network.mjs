import {lookup} from 'node:dns/promises';
import {request} from 'node:https';
import {request as httpRequest} from 'node:http';
import {isIP} from 'node:net';

export function publicOAuthUrl(value,{allowLoopback=false}={}){
 const u=new URL(value);if(u.username||u.password||u.hash||!['https:',...(allowLoopback?['http:']:[])].includes(u.protocol))throw Error('OAuth requires an HTTPS URL without credentials or fragment');
 const host=u.hostname.replace(/^\[|\]$/g,'');if(allowLoopback&&['127.0.0.1','::1','localhost'].includes(host))return u;
 if(isIP(host)&&privateAddress(host))throw Error('OAuth endpoint must not use a private address');if(u.protocol!=='https:'||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local'))throw Error('OAuth endpoint must be public');return u;
}
function privateAddress(address){
 if(address.includes(':'))return !/^2[0-9a-f]{3}:/i.test(address)||/^2001:(?:db8|0):/i.test(address);
 const [a,b]=address.split('.').map(Number);return a===0||a===10||a===127||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a>=224;
}
// DNS is resolved once and pinned to the socket. Redirects are returned to the
// SDK, never followed with credentials. Test loopback is a host-only option.
export function oauthFetch({allowLoopback=false,allowedOrigins,signal}={}){
 return async(input,options={})=>{
  if(input instanceof Request){options={method:input.method,headers:input.headers,signal:input.signal,...options};if(!['GET','HEAD'].includes(input.method)&&options.body===undefined)options.body=Buffer.from(await input.arrayBuffer());}const u=publicOAuthUrl(input instanceof Request?input.url:String(input),{allowLoopback});if(allowedOrigins&&!allowedOrigins.has(u.origin))throw Error('OAuth endpoint changed; discover and approve the new destination');
  const host=u.hostname.replace(/^\[|\]$/g,''),local=allowLoopback&&['127.0.0.1','::1','localhost'].includes(host);
  const addresses=isIP(host)?[{address:host,family:isIP(host)}]:await lookup(host,{all:true});if(!addresses.length||!local&&addresses.some(a=>privateAddress(a.address)))throw Error('OAuth endpoint resolves to a private address');
  const address=addresses[0],headers=Object.fromEntries(new Headers(options.headers).entries()),body=options.body;
  if(body!==undefined&&typeof body!=='string'&&!(body instanceof URLSearchParams)&&!Buffer.isBuffer(body))throw Error('Unsupported OAuth request body');
  const abort=AbortSignal.any([AbortSignal.timeout(30000),...([options.signal,signal].filter(Boolean))]);abort.throwIfAborted();
  return new Promise((resolve,reject)=>{
   const req=(u.protocol==='https:'?request:httpRequest)(u,{method:options.method||'GET',headers,signal:abort,lookup:(_name,opts,callback)=>callback(null,...(opts?.all?[[address]]:[address.address,address.family]))},res=>{
    const chunks=[];let size=0;res.on('data',b=>{size+=b.length;if(size>2*1024*1024){req.destroy(Error('OAuth response exceeds limit'));return}chunks.push(b)});res.on('error',reject);res.on('end',()=>resolve(new Response([204,205,304].includes(res.statusCode)?null:Buffer.concat(chunks),{status:res.statusCode,headers:res.headers})));
   });req.on('error',reject);if(body!==undefined)req.write(body instanceof URLSearchParams?body.toString():body);req.end();
  });
 };
}
