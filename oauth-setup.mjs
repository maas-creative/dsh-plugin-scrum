import {mkdir,readFile,writeFile,rename,chmod,stat,unlink} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'node:http';
import {discoverOAuthServerInfo} from '@modelcontextprotocol/client';
import {beginMcpLogin,oauthProvider} from './mcp-oauth.mjs';
import {McpConnections} from './mcp-extended.mjs';
import {oauthFetch,publicOAuthUrl} from './oauth-network.mjs';
import {agentRole,agentPolicy} from './agent-role.mjs';
import {GithubSetup} from './github-setup.mjs';

const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const name=v=>{if(!/^[A-Za-z0-9_-]{1,32}$/.test(v)||['__proto__','constructor','prototype'].includes(v))throw Error('Invalid OAuth profile name');return v};
const list=v=>{if(!Array.isArray(v)||v.length>100||v.some(x=>typeof x!=='string'||!x||x.length>2000||/[\s\x00-\x1f]/.test(x)))throw Error('Invalid OAuth scope/tool list');return [...new Set(v)].sort()};
async function read(path,fallback){try{return JSON.parse(await readFile(path,'utf8'))}catch(e){if(e.code==='ENOENT')return fallback;throw Error('OAuth settings are unreadable')}}
async function save(path,value){const tmp=path+'.'+randomUUID();await writeFile(tmp,JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});try{await rename(tmp,path)}catch(e){await unlink(tmp).catch(()=>{});throw e}}
export class OAuthSetup {
 constructor(directory,{allowLoopback=false,fetchFn,confirm,now=Date.now}={}){this.directory=resolve(directory);this.allowLoopback=allowLoopback;this.fetch=fetchFn||oauthFetch({allowLoopback});this.confirm=confirm||(()=>false);this.now=now;this.logins=new Map();this.githubs=new Map();this.mutations=Promise.resolve()}
 async init(){await mkdir(this.directory,{recursive:true,mode:0o700});await chmod(this.directory,0o700);if(!this.db){const p=join(this.directory,'oauth-setup.sqlite');this.db=new DatabaseSync(p);await chmod(p,0o600);this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS plans(id TEXT PRIMARY KEY,owner TEXT NOT NULL,value TEXT NOT NULL);')}}
 async config(){return read(join(this.directory,'mcp.json'),{mcpServers:{}})}
 async discover({url,provider='mcp'}){
  if(provider==='github')return {provider,registration:'github-manifest',documentation:'https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest',permissions:'GitHub App permission names with read/write levels; metadata read is mandatory',sharedApp:false};
  const endpoint=publicOAuthUrl(url,{allowLoopback:this.allowLoopback}).href,info=await discoverOAuthServerInfo(endpoint,{fetchFn:this.fetch});const m=info.authorizationServerMetadata;
  if(!m)return {provider:'mcp',url:endpoint,registration:'browser-required',reason:'No authorization-server metadata; use official developer-console documentation to register a dedicated client. No credentials were requested or sent.'};
  for(const field of ['issuer','authorization_endpoint','token_endpoint','registration_endpoint','revocation_endpoint'])if(m[field])publicOAuthUrl(m[field],{allowLoopback:this.allowLoopback});
  return {provider:'mcp',url:endpoint,issuer:m.issuer,authorizationEndpoint:m.authorization_endpoint,tokenEndpoint:m.token_endpoint,registrationEndpoint:m.registration_endpoint||null,registration:m.registration_endpoint?'dynamic':'browser-required',scopes:m.scopes_supported||info.resourceMetadata?.scopes_supported||[],pkce:m.code_challenge_methods_supported||[],metadata:info,metadataHash:hash(info),sharedApp:false};
 }
 async plan(input,owner){
  await this.init();name(input.name);if(typeof input.purpose!=='string'||!input.purpose.trim()||input.purpose.length>4000)throw Error('Explain the requested work');
  const discovery=await this.discover(input),scopes=list(input.scopes||[]),allowTools={};
  for(const [role,tools]of Object.entries(input.allowTools||{})){if(!/^[\w-]{1,80}$/.test(role))throw Error('Invalid role');allowTools[role]=list(tools)}
  if(!Object.keys(allowTools).length)throw Error('Select explicit MCP tools and roles; OAuth does not grant every tool');
  for(const scope of scopes)if(typeof input.scopeReasons?.[scope]!=='string'||!input.scopeReasons[scope].trim())throw Error('Explain why each scope is necessary: '+scope);
  if(discovery.scopes?.length&&scopes.some(s=>!discovery.scopes.includes(s)))throw Error('Requested scope is not advertised by the provider');
  const permissions=input.provider==='github'?{metadata:'read',...(input.permissions||{})}:undefined;
  if(permissions&&Object.entries(permissions).some(([k,v])=>!['contents','issues','pull_requests','metadata','actions','checks','deployments','discussions','workflows'].includes(k)||!['read','write'].includes(v)||k==='metadata'&&v!=='read'))throw Error('Invalid GitHub permission');
  const config=await this.config(),prior=config.mcpServers?.[input.name]||null,plan={id:randomUUID(),owner,expires:this.now()+3600000,status:'proposed',name:input.name,purpose:input.purpose.trim(),discovery,scopes,scopeReasons:input.scopeReasons||{},allowTools,...(permissions?{permissions}:{}),previousHash:hash(prior),clientCredentialsFile:input.clientCredentialsFile?resolve(input.clientCredentialsFile):null};
  this.db.prepare('INSERT INTO plans VALUES(?,?,?)').run(plan.id,owner,JSON.stringify(plan));return this.public(plan);
 }
 public(p){const {owner,previousHash,clientCredentialsFile,discovery,...rest}=p;const {metadata,...info}=discovery;return {...rest,discovery:info,credentialImport:!!clientCredentialsFile,clientCredentialsFile}}
 async get(id,owner){await this.init();const row=this.db.prepare('SELECT value FROM plans WHERE id=? AND owner=?').get(id,owner);if(!row)throw Error('OAuth plan is not owned by this session');const p=JSON.parse(row.value);if(p.expires<this.now()&&p.status!=='applied')throw Error('OAuth plan expired');return p}
 update(p){this.db.prepare('UPDATE plans SET value=? WHERE id=? AND owner=?').run(JSON.stringify(p),p.id,p.owner)}
 async serialize(job){const run=this.mutations.then(job);this.mutations=run.catch(()=>{});return run}
 async apply(id,owner,context){return this.serialize(()=>this.applyOwned(id,owner,context))}
 async applyOwned(id,owner,context){
  const p=await this.get(id,owner);if(p.status!=='proposed')throw Error('OAuth plan already consumed; use status/authorize');
  const summary=this.public(p);if(!await this.confirm({action:'apply',plan:summary,context}))return {applied:false,reason:'Human approval not received; no registration or configuration mutation'};
  context?.signal?.throwIfAborted();const current=await this.config();if(hash(current.mcpServers?.[p.name]||null)!==p.previousHash)throw Error('OAuth configuration changed; make a fresh plan');
  if(p.discovery.provider==='github'){
   if(current.mcpServers?.[p.name])throw Error('Existing GitHub App is preserved; permission changes require its owner to update the app and a new authorization');
   const instance=await this.github(p);const result=await instance.setup.start(instance.origin);p.status='applied';this.update(p);return {applied:true,registration:'browser-required',url:instance.origin+result.launch,permissions:p.permissions,profile:p.name,next:'Open the local manifest URL in the browser; complete provider registration and consent, then call authorize. No shared app.'};
  }
  const fresh=await this.discover({url:p.discovery.url});if(fresh.metadataHash!==p.discovery.metadataHash)throw Error('OAuth server metadata changed; make a fresh plan');
  let credentials={};if(p.clientCredentialsFile){const info=await stat(p.clientCredentialsFile);if(!info.isFile()||info.size>65536||info.mode&0o077)throw Error('Credentials must be a private0600 JSON file');credentials=await read(p.clientCredentialsFile,{});if(typeof credentials.clientId!=='string'||!credentials.clientId||credentials.clientSecret!==undefined&&typeof credentials.clientSecret!=='string')throw Error('Invalid private client credentials file');credentials={clientId:credentials.clientId,...(credentials.clientSecret?{clientSecret:credentials.clientSecret}:{})};}
  else if(current.mcpServers?.[p.name]?.oauth?.clientId)credentials={clientId:current.mcpServers[p.name].oauth.clientId,...(current.mcpServers[p.name].oauth.clientSecret?{clientSecret:current.mcpServers[p.name].oauth.clientSecret}:{})};
  if(!p.discovery.registrationEndpoint&&!credentials.clientId)return {applied:false,registration:'browser-required',issuer:p.discovery.issuer,next:'Register a dedicated client in the provider console with HTTP loopback callback. Store clientId/clientSecret in a0600 JSON file and create a new plan with clientCredentialsFile. Never put secrets in the chat.'};
  this.db.exec('BEGIN IMMEDIATE');try{const config=await this.config();if(hash(config.mcpServers?.[p.name]||null)!==p.previousHash)throw Error('OAuth configuration changed; make a fresh plan');config.mcpServers={...config.mcpServers,[p.name]:{url:p.discovery.url,type:'http',lifecycle:'lazy',oauth:{...credentials,issuer:p.discovery.issuer,scopes:p.scopes},allowTools:p.allowTools}};await save(join(this.directory,'mcp.json'),config);p.status='applied';this.update(p);this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}
  // Scope/issuer/client changes must not reuse a broader or unrelated grant.
  const provider=await oauthProvider(join(this.directory,'mcp-auth'),p.name,{...credentials,issuer:p.discovery.issuer,scopes:p.scopes});await provider.invalidateCredentials('tokens');await provider.saveDiscoveryState(p.discovery.metadata);
  return {applied:true,profile:p.name,registration:credentials.clientId?'dedicated-client':'dynamic-on-authorize',next:'Call authorize to register/request consent, then verify. skill_mcp reads the new profile on the next call.'};
 }
 async github(p){
  if(this.githubs.has(p.name))return this.githubs.get(p.name);
  let instance;const server=createServer(async(req,res)=>{try{if(req.headers.host!==new URL(instance.origin).host||req.method!=='GET')throw Error('Invalid callback');const u=new URL(req.url,instance.origin);res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; form-action https://github.com; frame-ancestors 'none'; base-uri 'none'");if(u.pathname==='/api/github-setup-form'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(await instance.setup.form(u.searchParams.get('state')))}else if(u.pathname==='/api/github-setup-callback'){await instance.setup.complete(u);res.end('Dedicated GitHub App registered. Return to the agent and authorize.')}else if(u.pathname==='/api/github-oauth-callback')await instance.setup.callback(req,res);else{res.statusCode=404;res.end('Not found')}}catch{res.statusCode=400;res.end('OAuth callback rejected')} });
  await new Promise((ok,no)=>{server.once('error',no);server.listen(0,'127.0.0.1',ok)});instance={owner:p.owner,server,origin:'http://127.0.0.1:'+server.address().port,setup:new GithubSetup(this.directory,{profile:p.name,permissions:p.permissions,allowTools:p.allowTools,fetchFn:this.fetch})};this.githubs.set(p.name,instance);return instance;
 }
 async authorize(profile,owner,context){
  await this.init();name(profile);if(this.logins.has(profile)){const active=this.logins.get(profile);if(active.owner!==owner)throw Error('Authorization belongs to another session');if(active.public.phase==='awaiting-provider-consent')return {profile,...active.public};active.login.close();this.logins.delete(profile);}
  const config=(await this.config()).mcpServers?.[profile];if(config?.enabled===false)throw Error('OAuth profile is disabled');if(!config?.oauth)throw Error('Apply a plan or use an existing dedicated OAuth profile first');
  // Even an existing profile may request a new grant; bind approval to its exact
  // destination, scopes and tool roles. An agent cannot supply an approved flag.
  if(!await this.confirm({action:'authorize',plan:{name:profile,url:config.url,scopes:config.oauth.scopes||[],allowTools:config.allowTools||{}},context}))return {authorized:false,reason:'Human approval not received'};
  if(this.githubs.has(profile)){const instance=this.githubs.get(profile);return {...await instance.setup.authorize(instance.origin),profile};}
  if(hash((await this.config()).mcpServers?.[profile])!==hash(config))throw Error('OAuth configuration changed during approval');const info=await this.discover({url:config.url}),origins=new Set([new URL(config.url).origin,...[info.issuer,info.authorizationEndpoint,info.tokenEndpoint,info.registrationEndpoint].filter(Boolean).map(u=>new URL(u).origin)]),fetchFn=oauthFetch({allowLoopback:this.allowLoopback,allowedOrigins:origins,signal:context?.signal});
  const login=await beginMcpLogin(join(this.directory,'mcp-auth'),profile,config,{fetchFn,timeoutMs:300000});const view={authorized:!login.url,authorizationUrl:login.url||null,phase:login.url?'awaiting-provider-consent':'authorized'};const row={login,owner,public:view};this.logins.set(profile,row);
  login.done.then(()=>{view.authorized=true;view.phase='authorized'},()=>{view.authorized=false;view.phase='retry-required'});context?.signal?.addEventListener('abort',()=>login.close(),{once:true});return {profile,...view};
 }
 async status(profile){await this.init();if(!profile)return {profiles:Object.entries((await this.config()).mcpServers||{}).filter(([,c])=>c.oauth).map(([n,c])=>({name:n,url:c.url,scopes:c.oauth.scopes||[],allowTools:c.allowTools||{}}))};name(profile);const c=(await this.config()).mcpServers?.[profile];if(!c?.oauth)throw Error('Unknown OAuth profile');const provider=await oauthProvider(join(this.directory,'mcp-auth'),profile,c.oauth);const token=await provider.tokens();return {profile,url:c.url,scopes:c.oauth.scopes||[],allowTools:c.allowTools||{},hasToken:!!token?.access_token,...(this.logins.get(profile)?.public||{}),note:'Token presence is not proof of working access; use verify'};}
 async verify(profile){name(profile);const config=(await this.config()).mcpServers?.[profile];if(!config?.oauth)throw Error('Unknown OAuth profile');const c=new McpConnections(join(this.directory,'mcp-auth'));try{const schemas=await c.tools(profile,config),allowed=new Set(Object.values(config.allowTools||{}).flat());return {profile,connected:true,tools:schemas.filter(t=>allowed.has(t.name)),missingRequestedTools:[...allowed].filter(n=>!schemas.some(t=>t.name===n)),unrestrictedToolsGranted:false}}finally{await c.close()}}
 async disconnect(profile,context){return this.serialize(()=>this.disconnectOwned(profile,context))}
 async disconnectOwned(profile,context){await this.init();name(profile);const before=(await this.config()).mcpServers?.[profile];if(!before?.oauth)throw Error('Unknown OAuth profile');if(!await this.confirm({action:'disconnect',plan:{name:profile,url:before.url,scopes:before.oauth.scopes||[]},context}))return {disconnected:false};this.db.exec('BEGIN IMMEDIATE');try{const config=await this.config();if(hash(config.mcpServers?.[profile])!==hash(before))throw Error('OAuth profile changed');config.mcpServers[profile]={...before,enabled:false};await save(join(this.directory,'mcp.json'),config);this.db.exec('COMMIT')}catch(e){this.db.exec('ROLLBACK');throw e}this.logins.get(profile)?.login.close();this.logins.delete(profile);const provider=await oauthProvider(join(this.directory,'mcp-auth'),profile,before.oauth);await provider.invalidateCredentials('tokens');return {disconnected:true,remoteGrantRevoked:false,next:'Local connection disabled and tokens removed. Remote grant remains until revoked in provider settings.'};}
 async closeOwner(owner){for(const [key,row]of this.logins)if(row.owner===owner){row.login.close();this.logins.delete(key)}for(const [key,instance]of this.githubs)if(instance.owner===owner){instance.setup.close();instance.server.closeAllConnections();await new Promise(r=>instance.server.close(r));this.githubs.delete(key)}}
 async close(){for(const row of this.logins.values())row.login.close();for(const {setup,server}of this.githubs.values()){setup.close();server.closeAllConnections();await new Promise(r=>server.close(r))}this.db?.close();this.db=null;}
}

export async function registerOAuthSetup(ctx,{directory}={}){
 const {homedir}=await import('node:os');const manager=new OAuthSetup(directory||join(process.env.DSH_HOME||join(homedir(),'.dsh'),'scrum'),{confirm:async({action,plan,context:exec})=>{
  const result=await ctx.tools.execute({name:'ask_user_question',arguments:{questions:[{id:'oauth-'+randomUUID(),header:'OAuth権限',question:JSON.stringify({action,...plan})+' この専用アプリへの登録・認可リクエストを許可しますか？ 認証情報はMac内だけに保存します。',options:[{label:'許可する',description:'表示された接続先・権限だけを設定する'},{label:'許可しない',description:'登録・認可リクエストを送信しない'}]}]},agent:exec.agent,callId:randomUUID(),rootCallId:exec.rootCallId||randomUUID(),parent:exec.token,signal:exec.signal});return !result.isError&&result.value?.answers?.[0]?.selected?.includes('許可する')===true;
 }});
 ctx.on?.('agent/disposed',({agent})=>manager.closeOwner(agent?.session.id));ctx.effect(()=>()=>manager.close());const {defineTool}=await import('@deepseek-ai/dsh-tools');ctx.tools.register(defineTool({name:'oauth_setup',description:'エージェントが専用OAuthアプリを設定する。discover→plan（最小scopeと理由・役割別toolを指定）→apply→authorize→verify。GitHub Manifestと標準MCP動的登録に対応。非対応サービスはbrowser-requiredとして構成を返す。本人の承認を内部の質問ツールで取得し、秘密・approvedフラグは受け取らない。',parameters:{action:{type:'string',required:true,enum:['discover','plan','apply','authorize','status','verify','disconnect']},input:{type:'json'},plan_id:{type:'string'},profile:{type:'string'}},output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},execute:async(args,exec)=>{
  const owner=exec.agent?.session.id;if(!owner)throw Error('OAuth requires an owning agent session');const action=args.action;
  if(['apply','authorize','disconnect'].includes(action)&&(exec.agent.session.header.parentSession||agentPolicy(exec.agent).readOnly&&agentRole(exec.agent)!=='planner'))throw Error('Only the owning parent may mutate OAuth settings');
  if(action==='discover')return JSON.stringify(await manager.discover(args.input||{}));if(action==='plan')return JSON.stringify(await manager.plan(args.input||{},owner));if(action==='apply')return JSON.stringify(await manager.apply(args.plan_id,owner,exec));if(action==='authorize')return JSON.stringify(await manager.authorize(args.profile,owner,exec));if(action==='status')return JSON.stringify(await manager.status(args.profile));if(action==='verify')return JSON.stringify(await manager.verify(args.profile));if(action==='disconnect')return JSON.stringify(await manager.disconnect(args.profile,exec));throw Error('Unknown OAuth action');
 }}));return manager;
}
