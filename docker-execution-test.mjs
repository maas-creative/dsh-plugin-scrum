import test from 'node:test';
import assert from 'node:assert/strict';
import {Session} from '@deepseek-ai/dsh-session';
import {createUserMessage,createAssistantMessage} from '@deepseek-ai/dsh-llm';
import {dockerExecution} from './docker-execution.mjs';
import {createStandaloneThreadAdapter} from './standalone-thread-adapter.mjs';
import {ScrumCoordinator} from './runtime.mjs';
import {dispatchReceipt} from './dispatch-receipt.mjs';
test('an accepted isolated Docker task starts while its parent is busy',async()=>{
 for(const [backend,expected] of [['docker',1],['native',0]]){
  const runtime=Object.create(ScrumCoordinator.prototype);let started=0;runtime.dir='/tmp/nonexistent-scrum-docker-queue-fixture';runtime.pi={executionBackend:backend};runtime.list=()=>[];runtime.s={all:sql=>sql.includes("LIKE 'scrumQueue:%'")?[{key:'scrumQueue:parent',value:'[{"taskId":"task","dispatch":true}]'}]:[],set(){},snapshot:()=>({tasks:[{id:'task',status:'todo'}]})};runtime.reports={isBusy:async()=>true,flush:async()=>{}};
  for(const name of ['reconcileTeamSessions','stopTeamMembers','collect','deliverWorkerMail','deliverThreadMail'])runtime[name]=async()=>{};runtime.dispatch=async()=>{started++};
  await runtime.runTick();assert.equal(started,expected);
 }
});
test('native time context and archived compaction checkpoints do not hide the dispatch terminal',()=>{
 const events=[{type:'user/message',data:{content:[{type:'text',text:'dispatch\nwork'}],source:{kind:'agent-message'}}},...['time-context','compact-checkpoint'].map(kind=>({type:'user/message',data:{source:{kind},content:[]}})),{type:'turn/end',data:{reason:{kind:'aborted',reason:{kind:'disposed'}}}}];
 assert.deepEqual(dispatchReceipt({snapshotEvents:()=>events},'dispatch\n'),{status:'failed',error:'aborted'});
 events.splice(2,0,{type:'user/message',data:{source:{kind:'user'},content:[]}});assert.equal(dispatchReceipt({snapshotEvents:()=>events},'dispatch\n'),null);
});
test('restart imports the stopped worker terminal without starting another model request',async()=>{
 const events=[{seq:0,type:'user/message',data:{source:{kind:'user'},content:[{type:'text',text:'dispatch\nwork'}]}}],remote=[...events,{seq:1,type:'turn/end',data:{reason:{kind:'aborted',reason:{kind:'disposed'}}}}];let launched=false,flushed=false;
 const writer={read:async()=>({events:[...events]}),append:async rows=>events.push(...rows),flush:async()=>{flushed=true},close:async()=>{}};
 class Host{async running(){return false}async historyCount(){return remote.length}async historyEvents(_binding,from,to){return remote.slice(from,to)}}class Harness{constructor(){launched=true}}
 const settings=new Map([['pi-send:request',{id:'worker',status:'uncertain',receiptMarker:'dispatch\n'}],['dockerWorker:worker',{id:'worker'}]]),store={setting:(key,fallback)=>settings.has(key)?settings.get(key):fallback,set:(key,value)=>settings.set(key,value)};
 const pi=dockerExecution({sessionPersistence:{stat:async()=>({}),open:async()=>writer}},store,{sessions:new Map()}, {},{Host,Harness});const result=await pi.reconcileDispatch('request');assert.equal(result.status,'failed');assert.equal(result.error,'aborted');assert.equal(events.length,2);assert.equal(flushed,true);assert.equal(launched,false);
});
test('Docker restart reconciles an uncertain assignment before retrying any model work',async()=>{
 let op={status:'uncertain',error:'flush on closed handle'},reconciled=0;const changes=[];
 const runtime=Object.create(ScrumCoordinator.prototype);runtime.list=()=>[{id:'assignment',taskId:'task',runId:'worker',status:'uncertain',taskVersion:1}];runtime.save=(_assignment,update)=>changes.push(update);
 runtime.s={setting:()=>op,snapshot:()=>({tasks:[]})};runtime.pi={executionBackend:'docker',sessions:new Map(),async reconcileDispatch(){reconciled++;op={status:'failed',error:'aborted'}}};
 assert.equal(await runtime.collectOnce(),true);assert.equal(reconciled,1);assert.deepEqual(changes,[{status:'error',error:'aborted'}]);
});
test('Docker mode refuses the host-only thread launch path',async()=>{
 const adapter=await createStandaloneThreadAdapter({}, {setting:key=>key==='workerSandbox'?{}:null},{sdk:{}});
 await assert.rejects(adapter.create({parentSession:'parent'}),/host thread execution is disabled/);await adapter.close();
});
test('writable Docker task refuses to launch without its existing Git worktree',async()=>{
 let launched=false;class Host{constructor(){}}class Harness{constructor(){launched=true}}
 const store={get:sql=>sql.includes('FROM runs')?{id:'worker',cwd:'/tmp'}:{version:1},setting:(key,fallback)=>key==='runPolicy:worker'?{readOnly:false}:key==='runRole:worker'?'executor':fallback};
 const native={sessions:new Map(),bind(){},async stop(){}};
 const pi=dockerExecution({agents:{get:()=>undefined}},store,native,{}, {Host,Harness});
 await assert.rejects(pi.prompt('worker','change source','request',{taskId:'task',taskVersion:1}),/existing isolated Git worktree/);assert.equal(launched,false);
});
test('Docker admission preserves pre-prompt history and deduplicates concurrent requests',async()=>{
 const settings=new Map([['runRole:worker','researcher'],['runPolicy:worker',{readOnly:true,allow:['read']}],['runModel:worker',{provider:'fixture',model:'fixture',reasoningEffort:'low'}]]),events=[];let header,invocations=0,hostFallback=0,prepared=0,closed=false,remote,stopReason='completed',vmExists=true;
 const writer={get header(){return header},read:async()=>({events:[...events]}),flush:async()=>{},close:async()=>{},append:async batch=>{assert.equal(batch[0].seq,events.length);events.push(...batch)}};
 const persistence={stat:async()=>header?{header,location:{path:'/sessions/worker/session.v4.jsonl'}}:undefined,create:async value=>{header=value;return writer},open:async()=>writer};
 let notify;const outputCaps=[];
 class Harness{
  constructor(options){outputCaps.push(options.maxTokens);const queue=[],waiting=[];notify=value=>waiting.length?waiting.shift().resolve(value):queue.push(value);this.client={subscribe:()=>({next:()=>queue.length?Promise.resolve(queue.shift()):new Promise((resolve,reject)=>waiting.push({resolve,reject})),close(){}})};this.finish=()=>{for(const waiter of waiting)waiter.reject(Error('closed'))};this.session=remote=Session.create('worker',events,header)}
  async start(){}
  emit(type,data,options){const event=this.session.append(type,data,options);notify({method:'session.event',params:{sessionId:'worker',event}});return event}
  async resumeSession(){this.emit('sandbox/mode',{mode:'read-only'})}
  async run(input){invocations++;this.emit('user/message',createUserMessage({content:[{type:'text',text:input}],source:{kind:'user'}}),{surfaceOp:'append'});this.emit('turn/start',{turn:1});this.emit('assistant/message',{turn:1,step:1,stream:[],message:createAssistantMessage({content:[{type:'text',text:'result'}],source:{provider:'fixture',model:'fixture'}})},{surfaceOp:'append'});this.emit('turn/end',{turn:1,reason:{kind:stopReason}});return {events:this.session.snapshotEvents(),finishReason:stopReason,finalResponse:'result'}}
  async close(){closed=true;this.finish()}
 }
 class Host{async exists(){return vmExists}async resetPolicyProof(){}async assertPolicy(){}async prepare(){prepared++;return {name:'synthetic',id:'worker',sourceSnapshot:{cwd:'/tmp',fingerprint:'trusted-source',excludedFiles:[],imageId:'fixture-image'}}}async historyEvents(_binding,from,to){return remote.snapshotEvents().slice(from,to)}async historyCount(){return remote.snapshotEvents().length}async stop(){}async remove(){}}
 const store={all:()=>[...settings.entries()].filter(([key])=>key.startsWith('pi-send:')).map(([,value])=>({value:JSON.stringify(value)})),setting:(key,fallback)=>settings.has(key)?settings.get(key):fallback,set:(key,value)=>settings.set(key,value),get:(sql)=>sql.includes('FROM runs')?{id:'worker',cwd:'/tmp'}:{version:1}};
 const native={sessions:new Map(),bind(){},async stop(){},async prompt(){hostFallback++}};
 const pi=dockerExecution({sessionPersistence:persistence,agents:{get:()=>undefined}},store,native,{providerPatch:{config:{providers:{fixture:{models:[{id:'fixture',maxTokens:32768}]}}}}}, {Host,Harness});pi.bind({ownerOf:()=>({parentSession:'parent'}),schedule(){}});
 try{
  const responses=await Promise.all([pi.prompt('worker','do task','request',{taskId:'task',taskVersion:1}),pi.prompt('worker','do task','request',{taskId:'task',taskVersion:1})]);assert.equal(responses[0].requestId,responses[1].requestId);
  for(let i=0;i<100&&settings.get('pi-send:request').status==='accepted';i++)await new Promise(resolve=>setTimeout(resolve,10));
  assert.equal(settings.get('pi-send:request').status,'completed');assert.equal(settings.get('pi-send:request').sourceSnapshot.fingerprint,'trusted-source');assert.equal(events[0].type,'session/end-seed');assert.equal(events[1].type,'sandbox/mode');assert.equal(events.length,6);assert.equal(header.parentSession,'parent');assert.equal(invocations,1);assert.equal(prepared,1);assert.equal(hostFallback,0);
  await pi.prompt('worker','do task','request',{taskId:'task',taskVersion:1});assert.equal(invocations,1);await assert.rejects(pi.prompt('worker','different','request',{taskId:'task',taskVersion:1}),/differs/);
  stopReason='max-tokens';await pi.prompt('worker','limited output','limited',{taskId:'task',taskVersion:1});for(let i=0;i<100&&settings.get('pi-send:limited').status==='accepted';i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(settings.get('pi-send:limited').status,'failed');assert.match(settings.get('pi-send:limited').error,/max-tokens/);assert.equal(pi.sessions.get('worker').status,'idle');assert.deepEqual(outputCaps,[undefined,undefined]);
  await pi.release('worker');vmExists=false;const retained=events.length;stopReason='completed';await pi.prompt('worker','continue after VM collection','recovered',{taskId:'task',taskVersion:1});for(let i=0;i<100&&settings.get('pi-send:recovered').status==='accepted';i++)await new Promise(resolve=>setTimeout(resolve,10));assert.equal(settings.get('pi-send:recovered').status,'completed');assert.equal(prepared,3);assert(events.length>retained);assert.equal(header.id,'worker');
  settings.set('dockerWorker:worker',settings.get('dockerWorkerLast:worker'));settings.set('pi-send:uncertain',{id:'worker',status:'uncertain',receiptMarker:'unknown'});const before=invocations;await assert.rejects(pi.prompt('worker','must not replay unknown dispatch','blocked',{taskId:'task',taskVersion:1}),/settled durable dispatch receipts/);assert.equal(invocations,before);
 }finally{await pi.stop()}assert.equal(closed,true);
});
test('only reviewed same-parent prerequisite artifacts enter the next worker',async()=>{
 const {mkdtemp,writeFile,rm,realpath}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{createHash}=await import('node:crypto'),{dependencyInputs}=await import('./docker-execution.mjs');
 const root=await realpath(await mkdtemp(join(tmpdir(),'scrum-artifact-')));try{
  const path=join(root,'report.md'),content='verified research';await writeFile(path,content);
  const task={id:'planner',cwd:root,dependencies:'["research"]'},dependency={id:'research',cwd:root,parentSession:'parent',status:'done',output:'report.md'},artifact={path,complete:true,hash:createHash('sha256').update(content).digest('hex')};
  const store={executionOnly:true,get:(sql,id)=>sql.includes('assignments')?{body:JSON.stringify({artifact})}:id==='planner'?task:dependency},owner={taskId:'planner',parentSession:'parent'};
  assert.equal((await dependencyInputs(store,owner))[0].content.toString(),content);
  dependency.parentSession='sibling';await assert.rejects(dependencyInputs(store,owner),/same scope/);dependency.parentSession='parent';
  dependency.status='review';await assert.rejects(dependencyInputs(store,owner),/same scope/);dependency.status='done';
  await writeFile(path,'changed');await assert.rejects(dependencyInputs(store,owner),/changed after review/);
 }finally{await rm(root,{recursive:true,force:true})}
});

test('validator uses a read-only source snapshot and a fixed report instead of a writable worktree',async()=>{const {rolePolicy}=await import('./roles.mjs');const policy=rolePolicy('validator');assert.equal(policy.readOnly,true);assert(policy.allow.includes('bash'));assert(policy.allow.includes('scrum_report'));assert(!policy.allow.includes('write'));assert(!policy.allow.includes('edit'))});
test('Docker verification snapshot includes source dependencies and keeps source and approved inputs read-only',async()=>{
 const {mkdtemp,mkdir,writeFile,realpath,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{DockerWorkerHost}=await import('./docker-worker-host.mjs');const root=await realpath(await mkdtemp(join(tmpdir(),'scrum-input-'))),calls=[];
 try{await mkdir(join(root,'independent'));await writeFile(join(root,'index.mjs'),'export {}');await writeFile(join(root,'independent','gateway.mjs'),'export {}');await writeFile(join(root,'independent','secret-filter.mjs'),'export {}');await writeFile(join(root,'independent','api-secret.json'),'{}');
 class Host extends DockerWorkerHost{async sbx(...args){calls.push(args);return ''}async exec(name,args){calls.push(args);return args.includes('rev-parse')?'baseline':''}}
 const host=new Host({sbxBin:'/sbx',imageArchive:'/image.tar',imageId:'sha256:'+'a'.repeat(64),baseURL:'http://127.0.0.1:8022'});await host.prepare({id:'11111111-1111-1111-1111-111111111111',cwd:root,policy:{readOnly:true},instruction:'test',credential:'synthetic',providerPatch:{}});
 assert(calls.some(c=>c[0]==='cp'&&c[1]===join(root,'independent','gateway.mjs')));assert(calls.some(c=>c[0]==='cp'&&c[1]===join(root,'independent','secret-filter.mjs')));assert(!calls.some(c=>c[0]==='cp'&&c[1]===join(root,'independent','api-secret.json')));const create=calls.find(c=>c[0]==='docker'&&c[1]==='create');assert(create.includes('type=bind,source=/srv/scrum/workspace,target='+root+',readonly'));assert(create.includes('type=bind,source=/srv/scrum/inputs,target=/inputs,readonly'));assert(calls.some(c=>c[0]==='ln'&&c[2]==='/opt/dsh/node_modules'));assert(calls.some(c=>c[0]==='ln'&&c[2]==='/opt/dsh/node_modules'&&c[3]==='/srv/scrum/config/node_modules'));
 }finally{await rm(root,{recursive:true,force:true})}
});
test('Docker report tool remains scoped while global tools are restricted by the real DSH service',async()=>{
 const {Context}=await import('@deepseek-ai/cordis'),{default:SystemPrompt}=await import('@deepseek-ai/dsh-system-prompt'),{default:Tools,defineTool}=await import('@deepseek-ai/dsh-tools'),{createScope}=await import('@deepseek-ai/dsh-scope'),{configureWorkerPolicy}=await import('./docker-worker-policy.mjs');
 const ctx=new Context();new SystemPrompt(ctx,{});new Tools(ctx);let scope;
 try{for(const name of ['read','bash','write'])ctx.tools.register(defineTool({name,description:name,parameters:{},output:{schema:{type:'string'},render:(_,v)=>[{type:'text',text:v}]},execute:()=>''}));const agent={session:{append(){}}};scope=createScope(ctx,agent);agent.ctx=scope.ctx;configureWorkerPolicy({tools:ctx.tools},{allow:['read','bash','scrum_report'],instruction:'synthetic'},agent);const names=ctx.tools.schemas(agent).map(t=>t.name);assert(names.includes('scrum_report'));assert(names.includes('bash'));assert(!names.includes('write'));assert(!ctx.tools.schemas().some(t=>t.name==='scrum_report'));}finally{await scope?.dispose();await ctx.fiber.dispose()}
});
test('Docker admission rejects missing report permission, wrong session and forbidden tools before model work',async()=>{
 const {DockerWorkerHost}=await import('./docker-worker-host.mjs');let proof={sessionId:'worker',readOnly:true,tools:['bash','scrum_report']};class Host extends DockerWorkerHost{async exec(){return JSON.stringify(proof)}}const host=new Host({sbxBin:'/sbx',imageArchive:'/image.tar',imageId:'sha256:'+'a'.repeat(64)}),binding={name:'synthetic',id:'worker'};assert.equal((await host.assertPolicy(binding,{readOnly:true})).sessionId,'worker');for(const changed of [{sessionId:'other'},{tools:['bash']},{tools:['bash','scrum_report','write']},{tools:['bash','scrum_report','session_read']},{readOnly:false}]){const original=proof;proof={...proof,...changed};await assert.rejects(host.assertPolicy(binding,{readOnly:true}),/policy did not activate/);proof=original}
});
