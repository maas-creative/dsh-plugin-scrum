import {randomUUID} from 'node:crypto';
const requireText=(v,label)=>{if(typeof v!=='string'||!v.trim()||v.length>200)throw Error(`${label} is required`);return v.trim()};
export class TeamStore {
 constructor(store){this.s=store}
 list(parent){return this.s.all("SELECT value FROM settings WHERE key LIKE 'scrumTeam:%'").map(r=>JSON.parse(r.value)).filter(t=>!parent||t.parentSession===parent)}
 participant(sessionId){return this.list().find(t=>t.status!=='deleted'&&(t.parentSession===sessionId||t.members.some(m=>m.sessionId===sessionId&&['active','shutdown_approved'].includes(m.status))))}
 get(id,parent){const t=this.s.setting('scrumTeam:'+id,null);if(!t||parent&&t.parentSession!==parent)throw Error('Team not found in this parent');return t}
 update(id,parent,fn){return this.s.tx(()=>{const t=this.get(id,parent);fn(t);t.version++;t.updated=Date.now();this.s.set('scrumTeam:'+id,t);return t})}
 create({name,parentSession,projectIds=[]}){return this.s.tx(()=>{name=requireText(name,'Team name');requireText(parentSession,'Parent');if(this.participant(parentSession))throw Error('Session already participates in an active team');if(this.list(parentSession).some(t=>t.name===name&&t.status!=='deleted'))throw Error('Team name already exists');for(const id of projectIds)this.s.requireProject(id);const t={id:randomUUID(),name,parentSession,projectIds,status:'active',members:[],claims:{},shutdownRequests:[],version:1,created:Date.now()};this.s.set('scrumTeam:'+t.id,t);return t})}
 member(id,parent,{name,sessionId,role='executor',remove=false}){return this.update(id,parent,t=>{if(t.status!=='active')throw Error('Team is inactive');name=requireText(name,'Member name');const old=t.members.find(m=>m.name===name);if(old?.status==='shutdown_approved')throw Error('Member shutdown is not complete');if(remove){if(Object.values(t.claims).some(c=>c.member===name&&c.expires>Date.now()))throw Error('Member has active claims');t.members=t.members.filter(m=>m.name!==name);return}sessionId=requireText(sessionId,'Session');const participation=this.participant(sessionId);if(participation&&(participation.id!==id||participation.parentSession===sessionId))throw Error('Session already participates in an active team');if(t.members.some(m=>m.sessionId===sessionId&&m.name!==name))throw Error('Session already joined');const m={name,sessionId,role,status:'active'};if(old)Object.assign(old,m);else t.members.push(m)})}
 claim(id,parent,{taskId,member,leaseMs=300000}){return this.update(id,parent,t=>{if(t.status!=='active'||!t.members.some(m=>m.name===member&&m.status==='active'))throw Error('Active membership required');const task=this.s.get('SELECT * FROM tasks WHERE id=?',taskId);if(!task||this.s.executionOnly&&task.parentSession!==parent||t.projectIds.length&&!t.projectIds.includes(task.projectId))throw Error('Task outside team');if(['done','cancelled'].includes(task.status))throw Error('Task is terminal');const blockers=JSON.parse(task.dependencies).filter(id=>this.s.get('SELECT status FROM tasks WHERE id=?',id)?.status!=='done');if(blockers.length)throw Error('Blocked by '+blockers.join(','));if(t.claims[taskId]?.expires>Date.now())throw Error('Already claimed');if(this.list().some(other=>other.id!==id&&other.claims[taskId]?.expires>Date.now()))throw Error('Already claimed by another team');if(!Number.isFinite(leaseMs)||leaseMs<1000||leaseMs>3600000)throw Error('Invalid lease');t.claims[taskId]={member,token:randomUUID(),expires:Date.now()+leaseMs};// Canonical owner remains Pi; membership identifies the execution actor.
 if(task.status!=='todo')throw Error('Only pending tasks can be claimed')})}
 heartbeat(id,parent,{taskId,token,leaseMs=300000}){return this.update(id,parent,t=>{const claim=t.claims[taskId];if(!claim||claim.token!==token||claim.expires<=Date.now())throw Error('Stale or invalid claim');if(!Number.isFinite(leaseMs)||leaseMs<1000||leaseMs>3600000)throw Error('Invalid lease');claim.expires=Date.now()+leaseMs})}
 release(id,parent,{taskId,token}){return this.update(id,parent,t=>{if(t.claims[taskId]?.token!==token)throw Error('Claim token mismatch');delete t.claims[taskId]})}
 shutdown(id,parent,{member,requestId,accept,reason=''}){return this.update(id,parent,t=>{
 const m=t.members.find(m=>m.name===member);if(!m)throw Error('Unknown member');
 let request,kind,to;
 if(requestId){request=t.shutdownRequests.find(r=>r.id===requestId&&r.member===member);if(!request)throw Error('Shutdown request required');const status=accept===true?'accepted':'rejected';if(request.status===status)return;if(request.status!=='pending')throw Error('Pending shutdown request required');request.status=status;request.responded=Date.now();request.responseReason=reason;kind=accept===true?'shutdown_approved':'shutdown_rejected';to=parent;if(accept===true){m.status='shutdown_approved';this.s.set('scrumTeamStop:'+request.id,{id:request.id,teamId:t.id,parentSession:parent,sessionId:m.sessionId,member,status:'pending',nextAt:Date.now()+250});for(const [key,c]of Object.entries(t.claims))if(c.member===member)delete t.claims[key]}}
 else{if(t.shutdownRequests.some(r=>r.member===member&&r.status==='pending'))return;request={id:randomUUID(),member,reason,status:'pending',created:Date.now()};t.shutdownRequests.push(request);kind='shutdown_request';to=m.sessionId}
 const key='scrumMailbox:'+to,message={id:randomUUID(),from:requestId?m.sessionId:parent,to,kind,teamId:t.id,requestId:request.id,member,message:JSON.stringify({kind,teamId:t.id,requestId:request.id,member,reason}),created:Date.now(),read:false};this.s.set(key,[...this.s.setting(key,[]),message]);if(requestId)this.s.set('scrumContinue:'+parent,true);
 })}

 observeSession(sessionId,{state,error=null}){
  if(!['running','idle','errored','unloaded'].includes(state))throw Error('Invalid session observation');
  for(const team of this.list().filter(t=>t.status==='active')){
   const member=team.members.find(m=>m.sessionId===sessionId);if(!member||member.status==='stopped'||state==='idle'&&member.executionStatus==='errored'||member.executionStatus===state&&member.executionError===error)continue;
   this.update(team.id,team.parentSession,t=>{const m=t.members.find(m=>m.sessionId===sessionId);m.executionStatus=state;m.executionError=error;m.observedAt=Date.now();
    if(state==='errored'){
     const key='scrumMailbox:'+t.parentSession,message={id:randomUUID(),from:sessionId,to:t.parentSession,kind:'member_error',teamId:t.id,member:m.name,message:JSON.stringify({kind:'member_error',teamId:t.id,member:m.name,error}),created:Date.now(),read:false};this.s.set(key,[...this.s.setting(key,[]),message]);this.s.set('scrumContinue:'+t.parentSession,true);
    }
   });
  }
 }
 delete(id,parent){return this.update(id,parent,t=>{if(t.members.some(m=>['active','shutdown_approved'].includes(m.status))||Object.values(t.claims).some(c=>c.expires>Date.now()))throw Error('Stop members and release claims first');t.status='deleted'})}
}
