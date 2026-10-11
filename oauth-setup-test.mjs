import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {OAuthSetup} from './oauth-setup.mjs';
import {oauthFetch} from './oauth-network.mjs';

test('agent OAuth workflow discovers, scopes, approves, registers, authorizes and disconnects with real SDK',async()=>{
 let base,registrations=0;const server=createServer(async(req,res)=>{
  const path=new URL(req.url,base).pathname;res.setHeader('Content-Type','application/json');
  if(path.startsWith('/.well-known/oauth-protected-resource'))return res.end(JSON.stringify({resource:base+'/mcp',authorization_servers:[base]}));
  if(path.startsWith('/.well-known/oauth-authorization-server'))return res.end(JSON.stringify({issuer:base,authorization_endpoint:base+'/authorize',token_endpoint:base+'/token',registration_endpoint:base+'/register',scopes_supported:['read'],response_types_supported:['code'],grant_types_supported:['authorization_code'],code_challenge_methods_supported:['S256']}));
  let raw='';for await(const c of req)raw+=c;
  if(path==='/register'){registrations++;return res.end(JSON.stringify({...JSON.parse(raw),client_id:'dedicated-test'}))}
  if(path==='/token'){assert(new URLSearchParams(raw).get('code_verifier'));return res.end(JSON.stringify({access_token:'test-only',token_type:'Bearer',expires_in:3600,scope:'read'}))}
  if(path==='/mcp'&&req.headers.authorization==='Bearer test-only'){if(req.method!=='POST'){res.statusCode=405;return res.end('{}')}const q=JSON.parse(raw);if(q.id===undefined){res.statusCode=202;return res.end()}return res.end(JSON.stringify({jsonrpc:'2.0',id:q.id,result:q.method==='initialize'?{protocolVersion:q.params.protocolVersion,capabilities:{tools:{}},serverInfo:{name:'oauth-fixture',version:'1'}}:q.method==='tools/list'?{tools:[{name:'status',description:'Project status',inputSchema:{type:'object'}},{name:'delete',inputSchema:{type:'object'}}]}:{content:[{type:'text',text:'Ready'}]}}))}
  res.statusCode=401;res.setHeader('WWW-Authenticate','Bearer resource_metadata="'+base+'/.well-known/oauth-protected-resource"');res.end('{}');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 const dir=await mkdtemp(join(tmpdir(),'scrum-agent-oauth-'));let approve=false;const manager=new OAuthSetup(dir,{allowLoopback:true,confirm:async()=>approve});
 try{
  const input={name:'dedicated',url:base+'/mcp',purpose:'Read project progress',scopes:['read'],scopeReasons:{read:'Read status only'},allowTools:{planner:['status']}};
  await assert.rejects(manager.plan({...input,scopes:['write']},'parent'),/Explain|advertised/);
  const plan=await manager.plan(input,'parent');assert.equal(plan.discovery.registration,'dynamic');assert.equal((await manager.apply(plan.id,'parent')).applied,false);assert.equal(registrations,0);await assert.rejects(readFile(join(dir,'mcp.json')),/ENOENT/);
  await assert.rejects(manager.apply(plan.id,'other'),/owned/);approve=true;assert.equal((await manager.apply(plan.id,'parent')).applied,true);await assert.rejects(manager.apply(plan.id,'parent'),/consumed/);
  const authorization=await manager.authorize('dedicated','parent');assert.equal(registrations,1);const url=new URL(authorization.authorizationUrl);assert.equal(url.searchParams.get('scope'),'read');assert.equal(url.searchParams.get('code_challenge_method'),'S256');await assert.rejects(manager.authorize('dedicated','other'),/another session/);
  const callback=new URL(url.searchParams.get('redirect_uri'));callback.searchParams.set('state',url.searchParams.get('state'));callback.searchParams.set('code','test-code');assert.equal((await fetch(callback)).status,200);await manager.logins.get('dedicated').login.done;
  assert.equal((await manager.status('dedicated')).hasToken,true);assert(!JSON.stringify(await manager.status('dedicated')).includes('test-only'));
  const verified=await manager.verify('dedicated');assert.equal(verified.connected,true);assert.deepEqual(verified.tools.map(t=>t.name),['status']);assert.deepEqual(verified.missingRequestedTools,[]);
  assert.equal((await manager.disconnect('dedicated')).disconnected,true);await assert.rejects(manager.authorize('dedicated','parent'),/disabled/);
 }finally{await manager.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true})}
});
test('OAuth network rejects private endpoints and redirects cannot leak authorization',async()=>{
 await assert.rejects(oauthFetch()('http://127.0.0.1/'),/HTTPS/);
 await assert.rejects(oauthFetch()('https://127.0.0.1/'),/private/);
 await assert.rejects(oauthFetch()('https://user:secret@example.com/'),/credentials/);
});
test('GitHub agent plan chooses dedicated profile and explicit rights without changing existing profiles',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-agent-github-'));const manager=new OAuthSetup(dir,{confirm:async()=>true});try{
 const p=await manager.plan({provider:'github',name:'research',purpose:'Read research issues',permissions:{issues:'read'},allowTools:{planner:['list_issues']}},'parent');assert.deepEqual(p.permissions,{metadata:'read',issues:'read'});const result=await manager.apply(p.id,'parent');assert.equal(result.registration,'browser-required');const page=await fetch(result.url);assert.equal(page.status,200);assert((await page.text()).includes('issues'));assert.equal((await manager.config()).mcpServers.research,undefined);
 }finally{await manager.close();await rm(dir,{recursive:true,force:true})}
});
test('native agent tool cannot inject approval and denies child mutation',async()=>{
 const {registerOAuthSetup}=await import('./oauth-setup.mjs');const dir=await mkdtemp(join(tmpdir(),'scrum-oauth-tool-'));const tools=new Map();let dispose;let questions=0;const ctx={effect:fn=>{dispose=fn()},tools:{register:t=>tools.set(t.name,t),execute:async()=>{questions++;return {value:{answers:[{selected:['許可しない']}]}}}}};const manager=await registerOAuthSetup(ctx,{directory:dir});try{
 const exec={agent:{session:{id:'parent',header:{}}},signal:new AbortController().signal};const input={provider:'github',name:'agent',purpose:'Read issues',permissions:{issues:'read'},allowTools:{planner:['list_issues']},approved:true};const plan=JSON.parse(await tools.get('oauth_setup').execute({action:'plan',input},exec));const rejected=JSON.parse(await tools.get('oauth_setup').execute({action:'apply',plan_id:plan.id},exec));assert.equal(rejected.applied,false);assert.equal(questions,1);assert.equal((await manager.config()).mcpServers.agent,undefined);
 await assert.rejects(tools.get('oauth_setup').execute({action:'apply',plan_id:plan.id},{...exec,agent:{session:{id:'child',header:{parentSession:'parent'}}}}),/owning parent/);
 }finally{await dispose();await rm(dir,{recursive:true,force:true})}
});
