// These functions execute entirely inside the WASM guest. They capture only
// serializable identifiers and invoke the validated host RPC surface.
export const DESKTOP_HANDLES_SOURCE = `
function __scrumWindow(value) {
 if (!value || typeof value !== 'object') return value;
 const id=value.id;
 const reads=['screenshot','ax','find','ref'];
 const inputs=['raise','click','doubleClick','move','drag','scroll','type','press'];
 const invoke=(method,args)=>{
  if (reads.includes(method)) return desktop.windowRead({id,method,args});
  if (inputs.includes(method)) return desktop.windowInput({id,method,args});
  throw new Error('Unsupported window operation');
 };
 for(const method of [...reads,...inputs]) Object.defineProperty(value,method,{value:(...args)=>invoke(method,args)});
 Object.defineProperty(value,'send',{value:(method,...args)=>invoke(method,args)});
 Object.defineProperty(value,'method',{value:method=>(...args)=>invoke(method,args)});
 return value;
}
function __scrumElement(value) {
 if (!value || typeof value !== 'object') return value;
 const ref=value.ref;
 for(const method of ['value','bounds','attributes','actions','parent','children'])
  Object.defineProperty(value,method,{value:(...args)=>desktop.elementRead({ref,method,args})});
 for(const method of ['setValue','perform','press','click','focus'])
  Object.defineProperty(value,method,{value:(...args)=>desktop.elementInput({ref,method,args})});
 return value;
}
`;
