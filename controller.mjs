import {parseDeliveryMode} from './delivery-gates.mjs';
// Adapter contract: snapshot(), readState(), writeState(state).
// Execution and verification remain owned by the host adapter.
function invalid(message){throw Object.assign(new Error(message),{status:400})}
export function start(adapter,input={}){
 const snapshot=adapter.snapshot(),{projects}=snapshot;
 const generic=snapshot.executionOnly===true&&!input.projectId;
 const project=projects.find(p=>p.id===input.projectId);
 const seen=new Set();let parent=project;
 while(parent){if(parent.status!=='active'||seen.has(parent.id))invalid('進行中のプロジェクトを選択してください');seen.add(parent.id);if(!parent.parentProjectId)break;parent=projects.find(p=>p.id===parent.parentProjectId);if(!parent)invalid('親プロジェクトが見つかりません');}
 if(!generic&&(!project||project.execution!=='auto'||!project.outcome||!project.output||!project.completionCriteria))invalid('実行許可・成果物・保存先・完了条件が設定されたプロジェクトを選択してください');
 const concurrency=input.concurrency??2;
 if(!Number.isInteger(concurrency)||concurrency<1)invalid('同時実行数は正の整数です');
 if(input.goal!==undefined&&(typeof input.goal!=='string'||input.goal.length>4000))invalid('Scrumの目標を確認してください');
 const limits={};for(const key of ['providerLimits','modelLimits']){const values=input[key]||{};if(typeof values!=='object'||Array.isArray(values)||Object.values(values).some(v=>!Number.isInteger(v)||v<0))invalid('接続先・モデルの同時実行数を確認してください');limits[key]={...values}}
 const staleTimeoutMs=input.staleTimeoutMs??3600000;if(!Number.isInteger(staleTimeoutMs)||staleTimeoutMs<0)invalid('活動停止の検知時間を確認してください');
 const state={deliveryMode:parseDeliveryMode({mode:input.deliveryMode,directive:input.goal||''}),active:true,projectIds:generic?[]:[project.id],executionOnly:generic,...(generic?{excludedTaskIds:input.excludedTaskIds||snapshot.tasks.filter(t=>['done','cancelled'].includes(t.status)).map(t=>t.id)}:{}),goal:input.goal?.trim()||(generic?'':project.outcome),concurrency,...limits,staleTimeoutMs,startedAt:Date.now(),phase:'planning'};
 adapter.writeState(state);return state;
}
export function pause(adapter){const state={...adapter.readState(),active:false,phase:'paused',pausedAt:Date.now()};adapter.writeState(state);return state;}
export function projectIds(adapter){
 const state=adapter.readState();if(!state.active)return null;
 const ids=new Set(state.projectIds||[]),{projects}=adapter.snapshot();
 let changed=true;while(changed){changed=false;for(const p of projects)if(ids.has(p.parentProjectId)&&!ids.has(p.id)){ids.add(p.id);changed=true}}
 return ids;
}
export function settle(adapter){
 const state=adapter.readState(),ids=projectIds(adapter);if(!ids)return state;
 const snapshot=adapter.snapshot(),tasks=snapshot.tasks.filter(t=>(state.executionOnly?!state.excludedTaskIds?.includes(t.id):ids.has(t.projectId))&&(t.actor!=='archived'||t.status==='done'));
 const assignments=(snapshot.assignments||[]).filter(a=>tasks.some(t=>t.id===a.taskId)&&!['done','cancelled'].includes(a.status));
 const done=tasks.length&&tasks.every(t=>t.status==='done')&&assignments.length===0;
 const finalChecks=state.executionOnly?tasks.map(t=>({executionId:t.id,verified:t.status==='done'&&Boolean(t.completionEvidence)})):snapshot.finalChecks||[];
 const verified=state.executionOnly?tasks.length>0&&tasks.every(t=>t.status==='done'&&t.completionEvidence):[...ids].every(id=>finalChecks.some(c=>c.projectId===id&&c.verified===true));
 const pendingCleanup={teamIds:(snapshot.teams||[]).filter(t=>t.status!=='deleted').map(t=>t.id),monitorIds:(snapshot.monitors||[]).filter(m=>m.active).map(m=>m.id)};
 const pendingWorkflowIds=(snapshot.workflows||[]).filter(w=>w.status!=='done').map(w=>w.id);
 const pendingPoolIds=(snapshot.workpools||[]).filter(p=>p.status==='open'||p.items.some(i=>!['completed','error','cancelled'].includes(i.status))||p.workers.some(w=>w.status==='busy')||!(p.aggregate?.delivered||p.aggregate?.suppressed&&p.aggregate.reason==='parent_stop')).map(p=>p.pool_id);
 const pendingTodos=(snapshot.pendingTodos||[]).filter(t=>['pending','in_progress'].includes(t.status));
 const pendingResourceIds=snapshot.pendingResourceIds||[];
 const deliveries=snapshot.deliveryGates||[];const pendingDeliveryIds=deliveries.filter(d=>d.completion?.ready!==true).map(d=>d.id);if(state.deliveryMode&&state.deliveryMode!=='direct'&&!deliveries.some(d=>d.mode===state.deliveryMode))pendingDeliveryIds.push('goal-delivery-workflow');const closed=!pendingDeliveryIds.length&&!pendingResourceIds.length&&!pendingPoolIds.length&&!pendingTodos.length&&!pendingWorkflowIds.length&&!pendingCleanup.teamIds.length&&!pendingCleanup.monitorIds.length;
 const phase=state.executionOnly&&(!state.goal||!tasks.length)?'planning':done?(verified&&closed?'completed':'verification'):assignments.some(a=>['running','preparing'].includes(a.status))?'running':assignments.some(a=>['review','ready'].includes(a.status))?'verification':assignments.some(a=>['error','blocked','conflict','uncertain'].includes(a.status))?'blocked':tasks.some(t=>t.actionable)?'planning':'blocked';
 const next={...state,phase,finalChecks,pendingCleanup,pendingResourceIds,pendingWorkflowIds,pendingPoolIds,pendingTodos,pendingDeliveryIds,active:phase!=='completed',updatedAt:Date.now()};adapter.writeState(next);return next;
}
export const ulwInstruction='\npicksのroleにはplanner/researcher/executor/reviewer/validatorの担当役割を指定できる。HardTackleがactiveの場合、親が所有する実行タスクの成果物を達成するまで既存タスクを進める。独立した実行可能タスクは同じターンのpicksでdispatch:trueを提案し、依存作業は前提の独立検証が終わるまで委譲しない。対象外のタスクを委譲しない。レビュー中の担当は先に成果物・ハッシュ・検証記録を確認する。失敗を成功扱いせず、不足条件・外部待ち・統合待ちは明示する。実行中の担当を重複起動しない。全体完成とタスク完了と提出受付を区別する。';

// Claim legacy state once so another parent cannot inherit the same active goal.
export function readExecutionState(store,parent){
 if(!parent)return store.setting('ulw',{});
 const key='ulw:'+parent,saved=store.setting(key,null);if(saved!==null)return saved;
 const legacy=store.setting('ulw',{}),owner=store.setting('ulwLegacyParent',null);
 if(Object.keys(legacy).length&&(!owner||owner===parent)){store.set('ulwLegacyParent',parent);store.set(key,{...legacy,parentSession:parent});return store.setting(key,{})}
 return {};
}
export const executionStopped=state=>['paused','completed','stopped'].includes(state.phase);
