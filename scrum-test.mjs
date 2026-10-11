import test from 'node:test';
import assert from 'node:assert/strict';
import {apply,start,pause,settle,projectIds,selectModel,defaultModel} from './index.mjs';
import {rolePolicy} from './roles.mjs';import {writeReport} from './report.mjs';
import {mkdtemp,rm,readFile,writeFile,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {recordParentNotice} from './native-notification.mjs';
import {serve,request} from './ipc.mjs';
test('親通知はモデルを起こさず履歴に一回保存し、実行中は配送を待つ',async()=>{
 const messages=[];let flushed=0;
 const agent={status:'idle',inbox:{nextStep:[],nextTurn:[]},session:{id:'parent',deriveMessages:()=>messages,append:(type,message,options)=>{assert.equal(type,'user/message');assert.equal(options.surfaceOp,'append');messages.push(message)}}};
 const ctx={sessions:{flush:async()=>{flushed++}}},input={notificationId:'notice',message:'成果物は未検証',senderSessionId:'child'};
 await recordParentNotice(ctx,agent,input,x=>x);await recordParentNotice(ctx,agent,input,x=>x);assert.equal(messages.length,1);assert.equal(messages[0].source.kind,'subagent-settled');assert.equal(messages[0].source.senderSessionId,'child');assert.equal(flushed,2);
 agent.status='running';await assert.rejects(recordParentNotice(ctx,agent,input,x=>x),/実行中/);
});
test('DSHとの接続はトークンを検証し、長いパスでも専用socketを生成',async()=>{
 const server=await serve('/tmp/'+('very-long-path-'.repeat(10))+'/rpc.sock',async r=>({parent:r.parentSession,method:r.method}));
 try{await assert.rejects(request(server.path,'wrong','status'),/権限/);assert.deepEqual(await request(server.path,server.token,'status',{},'parent'),{parent:'parent',method:'status'});}finally{await server.close()}
});
test('調査・レビューは通常の書込とシェルを持たず、固定の報告先だけに保存する',async()=>{
 assert(rolePolicy('researcher').readOnly);assert(!rolePolicy('reviewer').allow.includes('bash'));assert(!rolePolicy('reviewer').allow.includes('write'));assert(!rolePolicy('executor').readOnly);
 const dir=await mkdtemp(join(tmpdir(),'scrum-report-')),outside=await mkdtemp(join(tmpdir(),'scrum-outside-'));
 try{const path=join(dir,'reports','result.md');await writeReport(dir,path,'検証結果');assert.equal(await readFile(path,'utf8'),'検証結果');await assert.rejects(writeReport(dir,join(outside,'result.md'),'外部'),/作業フォルダ/);
 await writeFile(join(outside,'secret.md'),'保持');await symlink(join(outside,'secret.md'),join(dir,'link.md'));await assert.rejects(writeReport(dir,join(dir,'link.md'),'上書き'),/通常ファイル/);assert.equal(await readFile(join(outside,'secret.md'),'utf8'),'保持');
 }finally{await rm(dir,{recursive:true,force:true});await rm(outside,{recursive:true,force:true})}
});
function fixture(){
 let state={};const snapshot={projects:[{id:'root',status:'active',execution:'auto',outcome:'完成原稿',output:'paper.md',completionCriteria:'完成原稿の確認'},{id:'child',parentProjectId:'root',status:'active',execution:'auto',outcome:'分析結果',output:'analysis.md',completionCriteria:'分析結果の確認'}],tasks:[{id:'task',projectId:'child',status:'todo',actionable:true}],assignments:[],finalChecks:[{projectId:'root',verified:true},{projectId:'child',verified:true}]};
 return {snapshot:()=>snapshot,readState:()=>structuredClone(state),writeState:s=>{state=structuredClone(s)}};
}
test('verified artifacts do not complete a goal with pending parent Todos',()=>{
 const a=fixture(),snapshot=a.snapshot();snapshot.tasks[0].status='done';snapshot.pendingTodos=[{id:'verify-final',content:'Check final deliverable',status:'pending'}];
 start(a,{projectId:'root'});assert.equal(settle(a).phase,'verification');assert.equal(a.readState().pendingTodos.length,1);
 snapshot.pendingTodos[0].status='cancelled';assert.equal(settle(a).phase,'completed');
});
test('開始、子プロジェクトの範囲、停止、復旧用の状態を保持',()=>{
 const a=fixture();start(a,{projectId:'root'});assert.deepEqual([...projectIds(a)],['root','child']);
 const restored={...a};assert.equal(restored.readState().concurrency,2);
 pause(a);assert.equal(a.readState().phase,'paused');assert.equal(projectIds(a),null);assert.equal(settle(a).phase,'paused');
 assert.throws(()=>start(a,{projectId:'root',goal:5}),/目標/);assert.throws(()=>start(a,{projectId:'root',concurrency:0}),/同時/);
 a.snapshot().projects[0].status='paused';assert.throws(()=>start(a,{projectId:'child'}),/進行中/);
});
test('結果報告・統合待ちを完成にせず、全タスクの完了と未処理実行なしを要求',()=>{
 const a=fixture();start(a,{projectId:'root'});const s=a.snapshot();s.assignments=[{taskId:'task',status:'running'}];assert.equal(settle(a).phase,'running');
 s.assignments[0].status='review';assert.equal(settle(a).phase,'verification');s.tasks[0].status='reported';s.tasks[0].actionable=false;s.assignments=[];assert.equal(settle(a).phase,'blocked');
 s.tasks[0].status='done';s.assignments=[{taskId:'task',status:'uncertain'}];assert.equal(settle(a).phase,'blocked');s.assignments=[];s.finalChecks[0].verified=false;assert.equal(settle(a).phase,'verification');s.finalChecks[0].verified=true;assert.equal(settle(a).phase,'completed');assert.equal(a.readState().active,false);
});
test('モデルはタスク指定、役割指定、標準の順に選択',()=>{
 const role={provider:'p',model:'research'},task={provider:'p',model:'task'};const settings={roles:{researcher:role},tasks:{t:task}};
 assert.equal(selectModel(settings,'researcher','t'),task);assert.equal(selectModel(settings,'researcher'),role);assert.equal(selectModel(settings,'executor'),defaultModel);
});
test('DSHコマンドは実アダプターを呼び、未接続と開始失敗を成功扱いしない',async()=>{
 const commands=new Map(),ctx={commands:{register:c=>commands.set(c.name,c)}};await apply(ctx);
 assert.equal((await commands.get('scrum').handler({rawInput:'start {}'})).kind,'error');assert.equal(commands.get('scrum-roles').handler().kind,'success');
 const a=fixture();let plans=0;a.requestPlan=async()=>{plans++};await apply(ctx,{adapter:a});
 assert.equal((await commands.get('scrum').handler({rawInput:'start {"projectId":"root"}'})).kind,'success');assert.equal(plans,1);
 await commands.get('scrum').handler({rawInput:'pause'});assert.equal(a.readState().phase,'paused');
 a.requestPlan=async()=>{throw Error('dispatch failed')};assert.equal((await commands.get('scrum').handler({rawInput:'start {"projectId":"root"}'})).kind,'error');assert.equal(a.readState().phase,'paused');
});

test('成果物確認後もTeamの終了と監視の停止が済むまで全体完了にしない',()=>{
 const a=fixture();start(a,{projectId:'root'});const s=a.snapshot();s.tasks[0].status='done';s.teams=[{id:'team',status:'active',members:[{status:'stopped'}]}];s.monitors=[{id:'monitor',active:true}];let state=settle(a);assert.equal(state.phase,'verification');assert.equal(state.active,true);assert.deepEqual(state.pendingCleanup,{teamIds:['team'],monitorIds:['monitor']});s.teams[0].status='deleted';state=settle(a);assert.equal(state.phase,'verification');s.monitors[0].active=false;state=settle(a);assert.equal(state.phase,'completed');assert.equal(state.active,false);assert.deepEqual(state.pendingCleanup,{teamIds:[],monitorIds:[]});
});


test('parent mailbox acknowledges persisted notices and retries flush failure without duplicate history',async()=>{
 const {recordParentMailbox}=await import('./native-notification.mjs');const messages=[],settings=new Map([['scrumMailbox:parent',[{id:'one',from:'child',to:'parent',message:'report',read:false}]]]);let fail=true;
 const agent={status:'idle',session:{id:'parent',deriveMessages:()=>messages,append:(_,message)=>messages.push(message)},inbox:{nextStep:[],nextTurn:[]}},store={setting:(key,d)=>settings.get(key)||d,set:(key,v)=>settings.set(key,v),tx:fn=>fn()},ctx={sessions:{flush:async()=>{if(fail)throw Error('disk failure')}}};
 await assert.rejects(recordParentMailbox(ctx,agent,store,x=>x),/disk failure/);assert.equal(settings.get('scrumMailbox:parent')[0].read,false);assert.equal(messages.length,1);fail=false;await recordParentMailbox(ctx,agent,store,x=>x);await recordParentMailbox(ctx,agent,store,x=>x);assert.equal(messages.length,1);assert.equal(settings.get('scrumMailbox:parent')[0].read,true);
});

test('verified tasks cannot complete before their owned native resources are released',()=>{
 let state={active:true,phase:'verification',projectIds:['p']};const snapshot={projects:[{id:'p'}],tasks:[{id:'t',projectId:'p',status:'done'}],assignments:[{id:'a',status:'done',taskId:'t'}],finalChecks:[{projectId:'p',verified:true}],pendingResourceIds:['a']};const adapter={readState:()=>state,writeState:s=>state=s,snapshot:()=>snapshot};
 assert.equal(settle(adapter).phase,'verification');assert.deepEqual(state.pendingResourceIds,['a']);snapshot.pendingResourceIds=[];assert.equal(settle(adapter).phase,'completed');
});

test('completed-project tasks remain evidence for finishing their owned goal',()=>{
 let state={active:true,phase:'verification',projectIds:['p']};const adapter={readState:()=>state,writeState:s=>state=s,snapshot:()=>({projects:[{id:'p',status:'completed'}],tasks:[{id:'t',projectId:'p',status:'done',actor:'archived'}],assignments:[],finalChecks:[{projectId:'p',verified:true}]})};assert.equal(settle(adapter).phase,'completed');
});
