import {ThreadStore} from './thread.mjs';
import {readExecutionState,executionStopped} from './controller.mjs';
import {randomUUID,createHash} from 'node:crypto';
// Nodes reference canonical dashboard tasks; only execution metadata lives here.
export class DagStore {
 constructor(store){this.s=store}
 list(parent){return this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumDag:%'").map(r=>JSON.parse(r.value)).filter(d=>!parent||d.parentSession===parent)}
 get(id,parent){const d=this.s.setting('scrumDag:'+id,null);if(!d||parent&&d.parentSession!==parent)throw Error('DAG not found in this parent');return d}
 validate(taskIds,parent){if(!Array.isArray(taskIds)||!taskIds.length||new Set(taskIds).size!==taskIds.length)throw Error('Unique taskIds required');const visiting=new Set(),done=new Set(),visit=id=>{if(visiting.has(id))throw Error('Dependency cycle');if(done.has(id))return;const t=this.s.get('SELECT * FROM tasks WHERE id=?',id);if(!t)throw Error('Missing task '+id);if(this.s.executionOnly&&parent&&t.parentSession!==parent)throw Error('Execution task outside parent');visiting.add(id);for(const dep of JSON.parse(t.dependencies))visit(dep);visiting.delete(id);done.add(id)};taskIds.forEach(visit)}
 definition(taskIds){return taskIds.slice().sort().map(id=>{const t=this.s.get('SELECT dependencies FROM tasks WHERE id=?',id);return {taskId:id,dependsOn:JSON.parse(t.dependencies).sort()}})}
 hash(taskIds){return createHash('sha256').update(JSON.stringify(this.definition(taskIds))).digest('hex')}
 write(d,type,payload){d.version++;const {events,...state}=d;const event={seq:d.events.length+1,type,payload,created:Date.now(),state:structuredClone(state)};d.events.push(event);d.updated=event.created;this.s.set('scrumDag:'+d.id,d);return d}
 mutate(id,parent,version,fn,type,payload){return this.s.tx(()=>{const d=this.get(id,parent);if(version!==undefined&&version!==d.version)throw Error('DAG version conflict');const before=JSON.stringify(d);fn(d);if(JSON.stringify(d)===before)return d;return this.write(d,type,payload)})}
 create({parentSession,taskIds,name='Workflow',maxAttempts=3,idempotencyKey,idempotency_key}){return this.s.tx(()=>{if(typeof parentSession!=='string'||!parentSession.trim())throw Error('Parent required');this.validate(taskIds,parentSession);const requestKey=idempotencyKey||idempotency_key,definitionHash=this.hash(taskIds);if(requestKey){if(typeof requestKey!=='string'||requestKey.length>200)throw Error('Invalid idempotency key');const old=this.list(parentSession).find(d=>d.idempotencyKey===requestKey);if(old){if(old.definitionHash!==definitionHash||old.name!==name||old.maxAttempts!==maxAttempts)throw Error('DAG idempotency conflict');return old}}if(!Number.isInteger(maxAttempts)||maxAttempts<1||maxAttempts>20)throw Error('Invalid attempts');if(this.list().some(d=>d.status==='active'&&d.taskIds.some(id=>taskIds.includes(id))))throw Error('Task already belongs to an active DAG');const d={id:randomUUID(),parentSession,name,taskIds,definitionHash,idempotencyKey:requestKey||null,maxAttempts,status:'active',version:0,nodes:Object.fromEntries(taskIds.map(id=>[id,{attempts:0,state:'pending',checkpoint:null}])),events:[],created:Date.now()};return this.write(d,'created',{taskIds})})}
 frontier(id,parent,now=Date.now()){const d=this.get(id,parent);if(d.status!=='active')return [];if(d.definitionHash&&d.definitionHash!==this.hash(d.taskIds))throw Error('Canonical DAG definition changed; amend before dispatch');return d.taskIds.filter(id=>{const n=d.nodes[id],t=this.s.get('SELECT * FROM tasks WHERE id=?',id);return t&&!['done','cancelled'].includes(t.status)&&n.state==='pending'&&(!n.retryAt||n.retryAt<=now)&&JSON.parse(t.dependencies).every(dep=>this.s.get('SELECT status FROM tasks WHERE id=?',dep)?.status==='done')})}
 claim(id,parent,{taskId,owner,leaseMs=300000,version}){if(typeof owner!=='string'||!owner.trim()||!Number.isFinite(leaseMs)||leaseMs<1000||leaseMs>3600000)throw Error('Valid owner and lease required');return this.mutate(id,parent,version,d=>{if(!this.frontier(id,parent).includes(taskId))throw Error('Task not on frontier');Object.assign(d.nodes[taskId],{state:'running',owner,token:randomUUID(),expires:Date.now()+leaseMs,attempts:d.nodes[taskId].attempts+1});},'claimed',{taskId,owner})}
 leased(d,taskId,token){const n=d.nodes[taskId];if(!n||n.state!=='running'||n.token!==token||n.expires<=Date.now())throw Error('Stale or invalid lease');return n}
 heartbeat(id,parent,{taskId,token,leaseMs=300000}){if(!Number.isFinite(leaseMs)||leaseMs<1000||leaseMs>3600000)throw Error('Invalid lease');return this.mutate(id,parent,undefined,d=>{this.leased(d,taskId,token).expires=Date.now()+leaseMs},'heartbeat',{taskId})}
 checkpoint(id,parent,{taskId,token,data}){return this.mutate(id,parent,undefined,d=>{this.leased(d,taskId,token).checkpoint=data},'checkpoint',{taskId,data})}
 finish(id,parent,{taskId,token,error,retryDelayMs=1000}){if(!Number.isFinite(retryDelayMs)||retryDelayMs<0)throw Error('Invalid retry delay');return this.mutate(id,parent,undefined,d=>{const n=this.leased(d,taskId,token);if(error){n.error=String(error);n.state=n.attempts<d.maxAttempts?'pending':'failed';n.retryAt=Date.now()+retryDelayMs}else{const task=this.s.get('SELECT status FROM tasks WHERE id=?',taskId);if(task?.status!=='done')throw Error('Canonical task must pass review before DAG completion');n.state='done'}delete n.token;delete n.expires;if(d.taskIds.every(id=>d.nodes[id].state==='done'))d.status='done'},error?'failed':'completed',{taskId,error:error?String(error):null})}
 amend(id,parent,{taskIds,version}){return this.mutate(id,parent,version,d=>{if(d.status!=='active')throw Error('DAG is inactive');this.validate(taskIds,parent);if(this.list().some(other=>other.id!==id&&other.status==='active'&&other.taskIds.some(id=>taskIds.includes(id))))throw Error('Task already belongs to another DAG');for(const id of d.taskIds)if(!taskIds.includes(id)&&d.nodes[id].state==='running')throw Error('Cannot remove running node');d.taskIds=taskIds;d.definitionHash=this.hash(taskIds);d.nodes=Object.fromEntries(taskIds.map(id=>[id,d.nodes[id]||{state:'pending',attempts:0,checkpoint:null}]))},'amended',{taskIds})}
 reconstruct(id,parent,seq){const d=this.get(id,parent);if(seq===undefined)return structuredClone(d);const event=d.events.find(e=>e.seq===seq);if(!event?.state)throw Error('Historical snapshot unavailable for this event');return {...structuredClone(event.state),events:d.events.filter(e=>e.seq<=seq)}}
 subscription(id,parent,{after=0,capacity=1000}={}){if(!Number.isInteger(capacity)||capacity<1||capacity>10000||!Number.isInteger(after)||after<0)throw Error('Invalid stream bounds');const events=this.replay(id,parent,after),latest=this.get(id,parent).events.at(-1)?.seq||0;return {events:events.length>capacity?[{type:'dag.stream.overflow',after,latest,dropped:events.length-capacity},...events.slice(-capacity)]:events,cursor:latest,overflow:events.length>capacity}}
 replay(id,parent,after=0){return this.get(id,parent).events.filter(e=>e.seq>after)}
 reconcile(id,parent,{liveOwners=null,now=Date.now()}={}){return this.mutate(id,parent,undefined,d=>{for(const taskId of d.taskIds){const n=d.nodes[taskId],task=this.s.get('SELECT status FROM tasks WHERE id=?',taskId);if(task?.status==='done'){n.state='done';delete n.token;delete n.expires}else if(!task||task.status==='cancelled'){n.state='cancelled';delete n.token;delete n.expires}else if(n.state==='running'&&(n.expires<=now||liveOwners&&!liveOwners.includes(n.owner))){n.state=n.attempts<d.maxAttempts?'pending':'failed';n.error='Orphaned execution';delete n.token;delete n.expires}}if(d.taskIds.every(id=>d.nodes[id].state==='done'))d.status='done'},'reconciled',{now})}
}

export const teamDagMethods=['team_create','team_list','team_get','team_member','team_claim','team_heartbeat','team_release','team_shutdown','team_delete','dag_create','dag_list','dag_get','dag_frontier','dag_claim','dag_heartbeat','dag_checkpoint','dag_finish','dag_amend','dag_events','dag_reconstruct','dag_subscribe','dag_reconcile'];
export async function handleTeamDag(runtime,{method,args={},parentSession,callerSession}){
 if(!teamDagMethods.includes(method))return undefined;
 if(!parentSession)throw Error('Parent required');
 const parentState=runtime.state?.(parentSession)||readExecutionState(runtime.s,parentSession);
 if(executionStopped(parentState)&&['team_create','team_claim','dag_create','dag_claim'].includes(method))throw Error('Stopped or completed parent cannot start team/DAG work');
 if(executionStopped(parentState)&&method==='dag_frontier')return [];
 const {TeamStore}=await import('./team.mjs'),teams=new TeamStore(runtime.s),dags=new DagStore(runtime.s);
 const worker=callerSession&&callerSession!==parentSession;
 if(worker){const a=runtime.list().find(a=>a.runId===callerSession&&a.parentSession===parentSession);const thread=(runtime.threads||new ThreadStore(runtime.s,runtime.threadAdapter||{})).owner(callerSession);if(!a&&thread?.parentSession!==parentSession)throw Error('Caller is outside parent');if(!['dag_heartbeat','dag_checkpoint','dag_finish','team_shutdown','team_get','dag_get','dag_events'].includes(method))throw Error('Lead-only operation');if(method.startsWith('dag_')&&!['dag_get','dag_events'].includes(method)){const d=dags.get(args.id,parentSession);if(d.nodes[args.taskId]?.owner!==callerSession||a&&a.taskId!==args.taskId)throw Error('Caller does not own node')}if(method==='team_shutdown'){const t=teams.get(args.id,parentSession);if(!args.requestId||!t.members.some(m=>m.name===args.member&&m.sessionId===callerSession))throw Error('Caller does not own shutdown request')}}
 const api=method.startsWith('team_')?teams:dags,op=method.replace(/^(team|dag)_/,'');
 if(op==='create'){
 if(runtime.s.executionOnly&&args.taskIds?.some(id=>runtime.s.get('SELECT parentSession FROM tasks WHERE id=?',id)?.parentSession!==parentSession))throw Error('Execution task outside parent');
 const ids=args.projectIds||args.taskIds?.map(id=>runtime.s.get('SELECT projectId FROM tasks WHERE id=?',id)?.projectId)||[];
 const state=runtime.state?.(parentSession)||runtime.s.setting('ulw',{}),scope=new Set(state.projectIds||[]);
 for(let changed=true;changed;){changed=false;for(const p of runtime.s.snapshot().projects)if(scope.has(p.parentProjectId)&&!scope.has(p.id)){scope.add(p.id);changed=true}}
 if(scope.size&&ids.some(id=>!scope.has(id)))throw Error('Project outside parent scope');
 return api.create({...args,parentSession});
 }
 if(op==='list')return api.list(parentSession);
 if(op==='get')return api.get(args.id,parentSession);
 if(op==='reconstruct')return dags.reconstruct(args.id,parentSession,args.seq);
 if(op==='subscribe')return dags.subscription(args.id,parentSession,args);
 if(op==='events')return dags.replay(args.id,parentSession,args.after||0);
 if(op==='frontier')return dags.frontier(args.id,parentSession);
 if(method==='team_claim'&&runtime.list().some(a=>a.taskId===args.taskId&&!['done','cancelled'].includes(a.status)))throw Error('Task already has an execution actor');
 const result=api[op](args.id,parentSession,args);runtime.schedule?.();return result;
}

export async function tickDags(runtime){
 const dags=new DagStore(runtime.s);
 for(const dag of dags.list().filter(d=>d.status==='active')){
 const state=runtime.state?.(dag.parentSession)||{};if(/paused|completed|stopped|cancelled/.test(state.phase||''))continue;
 if(await runtime.reports?.isBusy(dag.parentSession))continue;
 // Keep live/review assignments leased until canonical review records completion.
 for(const taskId of dag.taskIds){const node=dags.get(dag.id).nodes[taskId];if(node.state!=='running')continue;const a=runtime.list().find(a=>a.taskId===taskId&&a.parentSession===dag.parentSession&&!['cancelled'].includes(a.status));const t=runtime.s.get('SELECT status FROM tasks WHERE id=?',taskId);if(t?.status==='done'){dags.reconcile(dag.id,dag.parentSession);continue}if(a&&['preparing','running','review','ready','uncertain'].includes(a.status)){if(node.expires>Date.now())dags.heartbeat(dag.id,dag.parentSession,{taskId,token:node.token});continue}if(a&&['error','blocked','conflict'].includes(a.status)&&node.expires>Date.now())dags.finish(dag.id,dag.parentSession,{taskId,token:node.token,error:a.error||a.status});}
 dags.reconcile(dag.id,dag.parentSession);
 for(const taskId of dags.frontier(dag.id,dag.parentSession)){
 const existing=runtime.list().find(a=>a.taskId===taskId&&!['done','cancelled'].includes(a.status));
 if(existing){if(existing.parentSession===dag.parentSession&&['error','blocked','conflict'].includes(existing.status)&&runtime.retry){try{await runtime.retry(existing.id,{automatic:true})}catch{continue}}else continue;}
 const task=runtime.s.snapshot().tasks.find(t=>t.id===taskId);if(!task?.actionable||task.owner!=='Pi')continue;
 const claimed=dags.claim(dag.id,dag.parentSession,{taskId,owner:dag.parentSession}),token=claimed.nodes[taskId].token;
 try{await runtime.dispatch([{taskId,action:task.nextAction||task.title,reason:'Persisted DAG dependency frontier',dispatch:true}],dag.parentSession);const a=runtime.list().find(a=>a.taskId===taskId&&a.parentSession===dag.parentSession&&['running','preparing'].includes(a.status));if(a)dags.mutate(dag.id,dag.parentSession,undefined,d=>{d.nodes[taskId].owner=a.runId||dag.parentSession},'dispatched',{taskId,assignmentId:a.id});else dags.mutate(dag.id,dag.parentSession,undefined,d=>{d.nodes[taskId].state='pending';d.nodes[taskId].attempts--;delete d.nodes[taskId].token;delete d.nodes[taskId].expires},'deferred',{taskId})}catch(error){dags.finish(dag.id,dag.parentSession,{taskId,token,error:error.message})}
 }
 }
}
