import {DeepSeekHarness,validatedSessionEvent} from '@deepseek-ai/dsh-sdk-client';
import {Session} from '@deepseek-ai/dsh-session';
import {createHash} from 'node:crypto';
import {open,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,relative,basename} from 'node:path';
import {executionContext} from './execution-store.mjs';
import {fileURLToPath} from 'node:url';
import {DockerWorkerHost,runProcess} from './docker-worker-host.mjs';
import {validateWorkspace} from './workspaces.mjs';
import {rolePolicy,roleInstruction} from './roles.mjs';
import {writeReport} from './report.mjs';
import {dispatchReceipt} from './dispatch-receipt.mjs';

// Only reviewed dependency artifacts cross worker boundaries, never private histories.
export async function dependencyInputs(store,owner){
 if(!owner?.taskId)return [];
 const task=store.get('SELECT * FROM tasks WHERE id=?',owner.taskId);if(!task)throw Error('Worker task is missing');
 const root=await realpath(executionContext(store,task).cwd),result=[];
 for(const id of new Set(JSON.parse(task.dependencies||'[]'))){
  const dependency=store.get('SELECT * FROM tasks WHERE id=?',id);
  if(!dependency||dependency.status!=='done'||store.executionOnly&&dependency.parentSession!==owner.parentSession||await realpath(executionContext(store,dependency).cwd)!==root)throw Error('Worker dependency is not completed in the same scope');
  const row=store.get("SELECT body FROM assignments WHERE taskId=? AND status='done' ORDER BY created DESC,rowid DESC LIMIT 1",id),artifact=row&&JSON.parse(row.body).artifact;
  if(!artifact?.complete||!artifact.hash||resolve(root,dependency.output)!==artifact.path)throw Error('Worker dependency has no verified artifact');
  const path=resolve(artifact.path),suffix=relative(root,path);
  if(!suffix||suffix.startsWith('..')||await realpath(path)!==path)throw Error('Worker dependency artifact escapes its source');
  const file=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{const stat=await file.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>200000)throw Error('Invalid dependency artifact file');const content=await file.readFile();if(createHash('sha256').update(content).digest('hex')!==artifact.hash)throw Error('Worker dependency artifact changed after review');result.push({name:id+'-'+basename(path),content})}finally{await file.close()}
 }
 return result;
}

// Scrum owns task admission and receipts. DSH owns the worker, protocol, history and compaction.
export function dockerExecution(ctx,store,native,config,{Host=DockerWorkerHost,Harness=DeepSeekHarness}={}){
 const host=new Host(config),handles=new Map(),opening=new Map(),work=new Set();let coordinator;
 const retain=id=>config.retainStoppedSandboxes&&store.setting('runPolicy:'+id,null)?.readOnly===true;
 const flushThrough=async(entry,seq)=>{const until=Date.now()+10000;while(entry.recorded<seq){if(entry.error)throw entry.error;if(Date.now()>until)throw Error('Docker worker event persistence did not reach its terminal sequence');await new Promise(resolve=>setTimeout(resolve,10))}await entry.append};
 const open=id=>{
  if(handles.has(id))return Promise.resolve(handles.get(id));
  if(opening.has(id))return opening.get(id);
  const pending=(async()=>{
   const row=store.get('SELECT * FROM runs WHERE id=?',id);if(!row)throw Error('Docker worker run is missing');
   if(store.setting('runFork:'+id,null))throw Error('Docker worker fork import has not been verified');
   if(ctx.agents.get(id))throw Error('Worker is already loaded outside Docker');
   const selected=store.setting('runModel:'+id,{}),role=store.setting('runRole:'+id,'executor'),policy=store.setting('runPolicy:'+id,null)||rolePolicy(role,row.cwd);
   const workspace=store.setting('piSessions',{})[id]?.workspace;
   if(!policy.readOnly&&(!workspace||await validateWorkspace(workspace)!==row.cwd))throw Error('Writable Docker workers require the existing isolated Git worktree');
   const prior=await ctx.sessionPersistence.stat(id);
   const writer=prior?await ctx.sessionPersistence.open(id,'write'):await ctx.sessionPersistence.create(Session.create(id,[],{...Session.create(id).header,cwd:row.cwd,parentSession:coordinator?.ownerOf(id)?.parentSession}).header);
   let harness,binding;
   try{
    await writer.flush();const saved=await writer.read();let next=saved.events.length;
    binding=store.setting('dockerWorker:'+id,null);
    if(binding&&!await host.exists(binding)){
     const operations=store.all("SELECT value FROM settings WHERE key LIKE 'pi-send:%'").map(row=>JSON.parse(row.value)).filter(op=>op.id===id);
     if(!saved.events.length||operations.some(op=>!['completed','failed'].includes(op.status)||!op.receiptMarker||!dispatchReceipt({snapshotEvents:()=>saved.events},op.receiptMarker)))throw Error('Missing Docker worker must have settled durable dispatch receipts before reprovisioning');
     store.set('dockerWorkerLast:'+id,binding);store.set('dockerWorker:'+id,null);binding=null;
    }
    if(!binding){
     const snapshot=await ctx.sessionPersistence.stat(id);
     const extra=store.setting('roleSettings',{})[role]?.prompt||'';
     const approvedInputs=await dependencyInputs(store,coordinator?.ownerOf(id));
     binding=await host.prepare({id,cwd:row.cwd,policy,instruction:roleInstruction(role,row.cwd)+(extra?'\n'+extra:'')+(approvedInputs.length?'\nReviewed prerequisite reports (read before surveying source again):\n'+approvedInputs.map(input=>'/inputs/'+input.name).join('\n'):''),approvedInputs,historyPath:snapshot.location?.path,historyRoot:config.sessionRoot,reportPath:store.setting('runReport:'+id,null),providerPatch:config.providerPatch,credential:config.credential});
     store.set('dockerWorker:'+id,{...binding,model:selected});
    }else{if(JSON.stringify(binding.model)!==JSON.stringify(selected))throw Error('Docker worker route changed; explicit reprovisioning is required');await host.refreshProvider(binding,config.providerPatch)}
    const maxTokens=selected.maxTokens;
    harness=new Harness({dshBin:fileURLToPath(new URL('./docker-sdk-entry.mjs',import.meta.url)),profile:'sdk',cwd:row.cwd,provider:selected.provider,model:selected.model,reasoningEffort:selected.reasoningEffort||'low',...(maxTokens===undefined?{}:{maxTokens}),initializeTimeoutMs:30000,env:{HOME:process.env.HOME,PATH:process.env.PATH,SCRUM_SBX_BIN:config.sbxBin,SCRUM_DOCKER_SANDBOX:binding.name}});
    await host.resetPolicyProof(binding);
    await harness.start();
    const entry={binding,writer,harness,status:'idle',append:Promise.resolve(),next,recorded:next-1,operation:null,calls:new Map()};
    const subscription=harness.client.subscribe(n=>n.method==='session.event'&&n.params.sessionId===id);
    entry.reading=(async()=>{try{while(true){const notification=await subscription.next(),event=validatedSessionEvent(notification.params.event);
     // DSH restores an end-seed marker before its live event bridge attaches.
     // Transfer that exact persisted prefix; never fabricate a replacement event.
     if(event.seq>entry.next){const prefix=await host.historyEvents(binding,entry.next,event.seq);for(const item of prefix)validatedSessionEvent(item);await writer.append(prefix);await writer.flush();entry.next=event.seq;entry.recorded=event.seq-1}
     if(event.seq!==entry.next)throw Error(`Docker worker history sequence differs: expected ${entry.next}, got ${event.seq} (${event.type})`);entry.next++;
     entry.append=entry.append.then(async()=>{await writer.append([event]);await writer.flush();entry.recorded=event.seq});await entry.append;
     if(!entry.operation)continue;
     const current=store.setting(entry.operation,{}),update={...current,lastEventAt:Date.now()};
     if(event.type==='turn/start')update.startedAt ||=Date.now();
     if(event.type==='tool/call'){entry.calls.set(event.data.callId,event.data.name);update.toolStarted=true}
     if(event.type==='tool/result')update.toolEvidence=[...(current.toolEvidence||[]),{toolName:entry.calls.get(event.data.message?.source?.callId)||'tool',result:event.data.message}];
     store.set(entry.operation,update);
    }}catch(error){if(!entry.closing){entry.error=error;entry.status='uncertain';coordinator?.schedule()}}finally{subscription.close()}})();
    await harness.resumeSession(id);
    await host.assertPolicy(binding,policy);
    if(entry.error)throw entry.error;
    entry.rpc={call:async method=>{if(method!=='abort')throw Error('Unsupported Docker worker RPC');await harness.close();await host.stop(binding);entry.status='idle'}};
    handles.set(id,entry);native.sessions.set(id,entry);return entry;
   }catch(error){await harness?.close().catch(()=>{});await writer.close();if(binding)await host.stop(binding).catch(()=>{});throw error}
  })().finally(()=>opening.delete(id));opening.set(id,pending);return pending;
 };
 const release=async id=>{const entry=handles.get(id);if(!entry)return {released:false};if(entry.status==='running')throw Error('Cannot release a running Docker worker');entry.closing=true;await entry.harness.close();await entry.reading;await entry.append;
  if(entry.completed&&!retain(id)){const saved=await entry.writer.read(),count=await host.historyCount(entry.binding);if(!Number.isSafeInteger(count)||count<saved.events.length)throw Error('Worker history differs at release');if(count>saved.events.length)await entry.writer.append(await host.historyEvents(entry.binding,saved.events.length,count));}
  await entry.writer.flush();await entry.writer.close();await host.stop(entry.binding);
  if(entry.completed&&!retain(id)){await host.remove(entry.binding);store.set('dockerWorkerLast:'+id,entry.binding);store.set('dockerWorker:'+id,null)}
  handles.delete(id);native.sessions.delete(id);return {released:true}};
 return {...native,
  executionBackend:'docker',
  bind(value){coordinator=value;native.bind(value)},
  async prompt(id,message,requestId,context){
   const key='pi-send:'+requestId,messageHash=createHash('sha256').update(JSON.stringify(message)).digest('hex'),prior=store.setting(key,null);
   if(prior){if(prior.id!==id||prior.messageHash!==messageHash)throw Error('Duplicate request id differs');return prior}
   if(store.get('SELECT version FROM tasks WHERE id=?',context.taskId)?.version!==context.taskVersion)throw Error('Task changed before Docker dispatch');
   if(handles.get(id)?.completed)await release(id);
   const entry=await open(id),admitted=store.setting(key,null);if(admitted){if(admitted.id!==id||admitted.messageHash!==messageHash)throw Error('Duplicate request id differs');return admitted}if(entry.status!=='idle')throw Error('Docker worker is running');
   if(store.get('SELECT version FROM tasks WHERE id=?',context.taskId)?.version!==context.taskVersion)throw Error('Task changed while loading Docker worker');
   const op={id,requestId,messageHash,sourceSnapshot:entry.binding.sourceSnapshot,status:'accepted',created:Date.now(),lastEventAt:Date.now(),toolEvidence:[],receiptMarker:'Scrum dispatch '+requestId+'\n'};
   store.set(key,op);entry.status='running';entry.operation=key;entry.calls.clear();
   const settled=entry.harness.run(op.receiptMarker+message,{sessionId:id}).then(async result=>{
    await flushThrough(entry,result.events.at(-1)?.seq??entry.recorded);await entry.writer.flush();
    if(result.finishReason!=='completed')throw Object.assign(Error('Worker ended with '+result.finishReason),{dispatchSettled:true});
    const policy=store.setting('runPolicy:'+id,null),workspace=store.setting('piSessions',{})[id]?.workspace;
    if(policy?.readOnly!==true){if(!workspace||await validateWorkspace(workspace)!==entry.binding.cwd)throw Error('Worker integration workspace changed');const patch=await host.changes(entry.binding);if(patch){await runProcess('git',['-C',workspace.path,'apply','--check','--binary','-'],{input:patch});await runProcess('git',['-C',workspace.path,'apply','--binary','-'],{input:patch})}}
    const reportPath=store.setting('runReport:'+id,null);if(reportPath){if(!store.setting(key,op).toolEvidence.some(row=>row.toolName==='scrum_report'&&row.result?.isError!==true))throw Object.assign(Error('Worker did not save a fresh report for this dispatch'),{dispatchSettled:true});const row=store.get('SELECT cwd FROM runs WHERE id=?',id);await writeReport(row.cwd,reportPath,await host.report(entry.binding))}
    entry.status='idle';entry.completed=true;
    if(!retain(id))await release(id);
    store.set(key,{...store.setting(key,op),status:'completed',result:result.finalResponse,finished:Date.now()});
   }).catch(async error=>{await entry.append.catch(()=>{});store.set(key,{...store.setting(key,op),status:error.dispatchSettled?'failed':'uncertain',error:error.message,finished:Date.now()});entry.status=error.dispatchSettled?'idle':'uncertain'}).finally(()=>{entry.operation=null;work.delete(settled);coordinator?.schedule()});
   work.add(settled);return op;
  },
  async reconcileDispatch(requestId){
   const key='pi-send:'+requestId,op=store.setting(key,null);if(!op)return {unknown:true};if(handles.get(op.id)?.status==='running')return {pending:true};if(['completed','failed'].includes(op.status))return op;
   if(!await ctx.sessionPersistence.stat(op.id))return {unknown:true};
   const binding=store.setting('dockerWorker:'+op.id,null);
   if(binding){
    if(await host.running(binding))return {pending:true};
    const writer=await ctx.sessionPersistence.open(op.id,'write');try{const saved=await writer.read(),count=await host.historyCount(binding);if(!Number.isSafeInteger(count)||count<saved.events.length)throw Error('Worker recovery history differs');if(count>saved.events.length){const prefix=await host.historyEvents(binding,saved.events.length,count);prefix.forEach(validatedSessionEvent);await writer.append(prefix);await writer.flush()}}finally{await writer.close()}
   }
   const reader=await ctx.sessionPersistence.open(op.id,'read');try{const saved=await reader.read(),receipt=dispatchReceipt({snapshotEvents:()=>saved.events},op.receiptMarker);if(!receipt)return {unknown:true};const result={...op,...receipt,reconciledAt:Date.now()};store.set(key,result);return result}finally{await reader.close()}
  },
  async compact(id){if(!store.get('SELECT id FROM runs WHERE id=?',id))return native.compact(id);const entry=await open(id);if(entry.status!=='idle')throw Error('Worker is running');entry.status='running';try{const result=await entry.harness.run('/compact',{sessionId:id});await flushThrough(entry,result.events.at(-1)?.seq??entry.recorded);return result}finally{entry.status='idle'}},
  async abortSession(id){const entry=handles.get(id);if(!entry)throw Error('Worker must be reconciled before abort');await entry.rpc.call('abort')},
  release,
  async stop(){for(const entry of handles.values()){entry.closing=true;await entry.harness.close();entry.status='idle'}await Promise.allSettled([...work]);for(const id of handles.keys())await release(id);await native.stop()},
 };
}
