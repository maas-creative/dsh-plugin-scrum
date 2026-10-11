import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';

export const BROWSER_ENGINE_ENV='OMO_BROWSER_ENGINE';
export const BROWSER_STATE_EVENT='omo.browser.state';
export const BROWSER_CONFIRMATION_POLICY='ask-before-irreversible';
export class BrowserEngineRefusal extends Error {constructor(code,message){super(message);this.name='BrowserEngineRefusal';this.code=code}}
export class BrowserUserStoppedError extends Error {constructor(message='Browser operation stopped by the user'){super(message);this.name='BrowserUserStoppedError';this.code='user_stopped'}}
export class BrowserActionDeclinedError extends Error {constructor(message,code='user_declined'){super(message);this.name='BrowserActionDeclinedError';this.code=code}}
export class BrowserNotConnectedError extends Error {constructor(message){super(message);this.name='BrowserNotConnectedError';this.code='browser_not_connected'}}
const allowed=new Set(JSON.parse(readFileSync(new URL('./browser-exports-policy.json',import.meta.url),'utf8')).allowedFunctions);
export function isIrreversibleLabel(label){return typeof label==='string'&&/\b(send|submit|delete|purchase|publish|subscribe|subscription|approve|confirm|pay|remove|post)\b/i.test(label)}
function labelFromHtml(value) {
  const html=typeof value==='string'?value:value?.html;
  if(typeof html!=='string'||Buffer.byteLength(html)>16384)return null;
  const {document}=parseHTML(html);
  const control=document.querySelector('button,a,input[type=submit],input[type=button],[role=button],[role=link]');
  if(!control)return null;
  return (control.getAttribute('aria-label')||control.textContent||control.getAttribute('value')||control.getAttribute('title')||'').trim().slice(0,512)||null;
}
export function textareaNewlineExpression(selector) {
  return '((selector)=>{const n=selector?document.querySelector(selector):document.activeElement;if(!n||n.tagName!=="TEXTAREA"||n.disabled||n.readOnly)return {scrumNewline:false};n.setRangeText("\\n",n.selectionStart,n.selectionEnd,"end");n.dispatchEvent(new Event("input",{bubbles:true}));return {scrumNewline:true}})('+JSON.stringify(selector??null)+')';
}
function approved(result) {
  const value=result?.details??result;
  if(value?.status!=='answered'||!value.answers||typeof value.answers!=='object')return false;
  const answers=Object.values(value.answers);
  return answers.length===1&&answers[0]==='Allow';
}
async function hostStopped(host) {
  if(!host?.callTool)return false;
  try {
    const receipt=await host.callTool('omo_browser_bridge',{op:'status'});
    const state=receipt?.details??receipt;
    return state?.stopped===true||state?.userStopped===true||state?.status==='stopped';
  }catch{return false}
}

async function guardedSession(session,host) {
  if(typeof session?.tool!=='function')return session;
  const rawTool=session.tool.bind(session),rawStop=session.stop?.bind(session),client=session.client;
  let stopped=false,tail=Promise.resolve();
  const check=()=>{if(stopped||session.stopped)throw new BrowserUserStoppedError()};
  const bridge=async data=>{if(!host?.callTool)return;try{await host.callTool('omo_browser_bridge',{op:'state',data:{engine:'connected',session:session.sessionId,...data}})}catch{}};
  const status=async()=>{
    check();
    if(await hostStopped(host)){stopped=true;throw new BrowserUserStoppedError()}
    check();
  };
  const confirm=async action=>{
    check();
    if(!host?.callTool)throw new BrowserActionDeclinedError('Browser action requires a human confirmation host');
    await bridge({status:'awaiting_confirmation',action});
    const reply=await host.callTool('ask_user_question',{waitForAnswer:true,questions:[{header:'Browser',question:'Allow this potentially irreversible browser action ('+action+')?',multiSelect:false,options:[{label:'Allow',description:'Authorize this action once.'},{label:"Don't allow",description:'Keep the page unchanged.'}]}]});
    check();
    if(!approved(reply))throw new BrowserActionDeclinedError('Browser action was not explicitly approved');
    await status();
  };
  const risky=async(name,params)=>{
    if(name==='click') {
      let label=null;
      try {
        if(params.ref)label=labelFromHtml(await rawTool('get_html',{ref:params.ref,tab_id:params.tab_id,max_bytes:4096}));
        else if(params.selector) {
          const expression='((selector)=>{const node=document.querySelector(selector);return node?{label:(node.getAttribute("aria-label")||node.textContent||node.getAttribute("title")||"").trim().slice(0,512)}:null})('+JSON.stringify(params.selector)+')';
          const result=await rawTool('evaluate',{expression,tab_id:params.tab_id,return_by_value:true});
          const value=result?.value??result?.result?.value??result;
          if(typeof value?.label==='string')label=value.label;
        }
      }catch{}
      return !label||isIrreversibleLabel(label);
    }
    if(name==='press')return /^(enter|return)$/i.test(params.key||'');
    if(name==='evaluate')return /\.(click|submit|requestSubmit|dispatchEvent|sendBeacon)\s*\(|\bfetch\s*\(|\blocation\s*=/.test(params.expression||'');
    return /(?:^|_)(delete|submit|send|purchase|publish|remove)(?:_|$)/i.test(name);
  };
  const invoke=async(name,params={})=>{
    if(params.session_id!==undefined&&params.session_id!==session.sessionId)throw new BrowserEngineRefusal('browser_session_scope','Cannot operate another browser session');
    await status();
    if(name==='press'&&/^(enter|return)$/i.test(params.key||'')&&!params.ref&&!(params.modifiers?.length)) {
      await bridge({status:'acting',action:'newline'});
      await status();
      const reply=await rawTool('evaluate',{expression:textareaNewlineExpression(params.selector),tab_id:params.tab_id,return_by_value:true});
      const value=reply?.value??reply?.result?.value??reply;
      if(value?.scrumNewline===true){await bridge({status:'idle',action:'newline'});return reply}
      await status();
    }
    if(await risky(name,params))await confirm(name);
    check();
    await bridge({status:'acting',action:name});
    check();
    try{const result=await rawTool(name,params);await bridge({status:'idle',action:name});return result}
    catch(error){await bridge({status:'failed',action:name,reason:error.name});throw error}
  };
  const queue=(name,params)=>{
    try{check()}catch(error){return Promise.reject(error)}
    let captured;
    try{captured=structuredClone(params??{})}catch(error){return Promise.reject(error)}
    const pending=tail.then(()=>invoke(name,captured));
    tail=pending.catch(()=>{});
    return pending;
  };
  const stop=async()=>{
    if(stopped)return null;
    stopped=true;
    try{return await rawStop?.()}finally{await bridge({status:'stopped'})}
  };
  Object.defineProperty(session,'tool',{value:queue,configurable:true});
  Object.defineProperty(session,'stop',{value:stop,configurable:true});
  if(client?.call)Object.defineProperty(session,'client',{configurable:true,get:()=>new Proxy(client,{get(target,key){
    if(key==='call')return(method,params={})=>{
      if(method.startsWith('tool.'))return queue(method.slice(5),params);
      if(method==='session.stop'&&params.session_id===session.sessionId)return stop();
      if(method==='system.status')return target.call(method,params);
      throw new BrowserEngineRefusal('browser_rpc_scope','Raw browser RPC is outside the owning session');
    };
    if(key==='callWithHandle'||key==='resolveSocket'||key==='cancel')return function(){throw new BrowserEngineRefusal('browser_rpc_scope','Raw transport access is outside the owning session')};
    const value=Reflect.get(target,key,target);
    if(typeof value==='function')return function(){throw new BrowserEngineRefusal('browser_rpc_scope','Unrecognized transport operation is not permitted')};
    return value;
  }})});
  await bridge({status:'started'});
  return session;
}

export function guardOmowright(runtime,{env=process.env,host}={}) {
  if(!runtime)return runtime;
  const engine=env[BROWSER_ENGINE_ENV];
  if(!engine)return runtime;
  return new Proxy(runtime,{get(target,key) {
    const value=Reflect.get(target,key);
    if(typeof value!=='function')return value;
    if(key==='connectBrowserSkill')return async(...args)=>{
      if(!['connected','builtin','none'].includes(engine))throw new BrowserEngineRefusal('browser_engine_invalid','Unsupported browser engine: '+engine);
      if(engine!=='connected')throw new BrowserEngineRefusal('browser_engine_'+engine,'Connected browser is disabled for this session');
      if(await hostStopped(host))throw new BrowserUserStoppedError();
      const session=await value(...args);return guardedSession(session,host);
    };
    if(allowed.has(key))return value;
    if(['connect','connectPipe','connectCloakProfile'].includes(key))return async function(){throw new BrowserEngineRefusal('browser_engine_owned_blocked','This session cannot start an owned browser')};
    return function(){throw new BrowserEngineRefusal('browser_engine_export_blocked','Unguarded export is not available in this session')};
  }});
}
