import {registerScrumUi} from './scrum-ui-host.mjs';
import {registerScrumPanel} from './scrum-panel.mjs';
import {registerDeliveryAuthorization} from './delivery-authorization.mjs';
import {registerSessionNotifications} from './session-notification.mjs';
import {registerGateway} from './gateway.mjs';
import {registerOpenGateway} from './opengateway.mjs';
import {registerLifecycle} from './lifecycle.mjs';
import {registerDegradationRecovery} from './degradation-recovery.mjs';
import {registerGitAttribution} from './git-attribution.mjs';
import {registerLookAt} from './look-at.mjs';
import {registerSideConversations} from './side-conversation.mjs';
import {registerRoleContext} from './role-context.mjs';
import {registerUsageReminders} from './usage-reminders.mjs';
import {registerScrumSkills} from './skill-provider.mjs';
import {registerSkillInputs} from './skill-input.mjs';
import {registerGoalUsage} from './goal-usage.mjs';
import {registerNativeTaskCommands} from './native-task-commands.mjs';
import {registerWebTools} from './web-tools.mjs';
import {registerXSearch} from './x-search.mjs';
import {registerTodos} from './todos.mjs';
import {registerClaudeHooks} from './claude-hooks.mjs';
import {registerHooks} from './hooks.mjs';
import {registerFsyncWarning} from './fsync-warning.mjs';
import {registerToolRetention} from './tool-retention.mjs';
import {registerCliCompatibility} from './cli-compat.mjs';
import {workflowMethods} from './workflow.mjs';
import {threadMethods} from './thread.mjs';
import {relayMethods} from './relay.mjs';
import {registerHardTackle} from './ultrawork.mjs';
import {registerOperationTools} from './operation-tools.mjs';
import {teamDagMethods} from './dag.mjs';
import {registerOAuthSetup} from './oauth-setup.mjs';
import {registerMcp} from './mcp.mjs';
import {registerContext} from './context.mjs';
import {start,pause,settle} from './controller.mjs';
import {roles} from './roles.mjs';
import {request} from './ipc.mjs';
export {ScrumPlanner,workDay} from './planner.mjs';
export {ScrumCoordinator} from './runtime.mjs';
export {recordParentNotice} from './native-notification.mjs';
export {ParentReports} from './parent-reports.mjs';
export {roles,roleInstruction,rolePolicy} from './roles.mjs';
export {selectModel,defaultModel,fallbackModels,mayRetryModel} from './models.mjs';
export {start,pause,settle,projectIds,ulwInstruction} from './controller.mjs';
export const name='scrum';
export const inject=['skills','commands','tools','fs','systemPrompt','sessionPersistence','attachments','llm','agents','sessions','goals','sessionProjections','sandbox','sandboxPolicy','credentials','compaction'];
export async function apply(ctx,config={}){
 if(config.standalone===undefined&&!config.runtime&&!config.socket&&!process.env.DSH_SCRUM_SOCKET&&ctx.agents&&ctx.sessions&&ctx.sessionPersistence&&ctx.effect)config={...config,standalone:true};
 if(ctx.llm?.registerAdapter&&ctx.llm?.registerConfigurableProviders)await registerOpenGateway(ctx,{config:config.providerConfig||{}});
 registerScrumSkills(ctx);
 const lifecycle=ctx.commands&&typeof ctx.on==='function'?registerLifecycle(ctx,config.lifecycle||{}):null;
 if(ctx.skills?.list&&ctx.skills?.get&&ctx.commands?.list)await registerSkillInputs(ctx);
 if(ctx.tools&&typeof ctx.on==='function')registerGitAttribution(ctx);
 if(ctx.systemPrompt&&ctx.tools&&typeof ctx.on==='function')registerRoleContext(ctx,{coordinator:Boolean(config.runtime||config.socket||config.standalone||process.env.DSH_SCRUM_SOCKET)});
 if(ctx.tools&&ctx.skills?.list&&typeof ctx.on==='function')registerUsageReminders(ctx);
 if(config.standalone){if(config.runtime||config.socket||process.env.DSH_SCRUM_SOCKET)throw Error('Standalone and external Scrum runtime cannot both own the ledger');const {createStandaloneRuntime,registerStandaloneTools}=await import('./standalone.mjs');const runtime=await createStandaloneRuntime(ctx,typeof config.standalone==='object'?config.standalone:{});config={...config,runtime};await registerStandaloneTools(ctx,runtime);if(config.relay){const {registerRelayCommands}=await import('./relay-transport.mjs');await registerRelayCommands(ctx,runtime,config.relay)}ctx.effect(()=>()=>runtime.standalone.close())}
 if(!config.standalone&&config.runtime?.s?.executionOnly){const {registerStandaloneTools}=await import('./standalone.mjs');await registerStandaloneTools(ctx,config.runtime)}
 if(ctx.fs&&ctx.sessionPersistence){const {registerNativeTools}=await import('./native-tools.mjs');await registerNativeTools(ctx);registerLookAt(ctx,{audio:config.audio});if(ctx.agents&&ctx.sessions&&ctx.effect)registerSideConversations(ctx);registerWebTools(ctx);await registerXSearch(ctx,config.xSearch);registerTodos(ctx);registerOperationTools(ctx);await registerMcp(ctx);await registerOAuthSetup(ctx);}
 if(config.runtime)registerDeliveryAuthorization(ctx,config.runtime);
 if(config.runtime)registerNativeTaskCommands(ctx,config.runtime);
 if(ctx.agents&&typeof ctx.on==='function')registerSessionNotifications(ctx,{runtime:config.runtime,...config.sessionNotification});
 if(ctx.commands&&typeof ctx.on==='function')await registerGateway(ctx,{runtime:config.runtime,...config.gateway});
 if(ctx.agents&&ctx.sessions&&ctx.sessionProjections&&ctx.tools&&typeof ctx.on==='function')registerDegradationRecovery(ctx,{runtime:config.runtime});
 if(ctx.tools&&typeof ctx.on==='function')registerHooks(ctx,{...config.hooks,notify:event=>{config.hooks?.notify?.(event);config.runtime?.events?.append(event.sessionId,'hook.observed',event)}});
 if(ctx.tools&&typeof ctx.on==='function')registerFsyncWarning(ctx);
 if(ctx.tools&&typeof ctx.on==='function')registerToolRetention(ctx);
 if(config.claudeHooks)await registerClaudeHooks(ctx,config.claudeHooks);
 const adapter=config.adapter;
 const socket=config.socket||process.env.DSH_SCRUM_SOCKET,token=config.token||process.env.DSH_SCRUM_TOKEN;
 const remote=config.runtime?(method,args={},parentSession)=>config.runtime.handle({method,args,parentSession}):socket&&token?(method,args={},parentSession)=>request(socket,token,method,args,parentSession||process.env.DSH_SESSION_ID):null;
 registerScrumPanel(ctx,remote);
 if(ctx.root?.reflect)registerScrumUi(ctx,remote,config.runtime);
 registerCliCompatibility(ctx,{...config.lifecycle,remote,runtime:config.runtime});
 if(ctx.fs&&ctx.sessionPersistence){registerContext(ctx,remote,{migrationHomeDir:config.configurationMigration?.homeDir});registerHardTackle(ctx,remote);}
 if(adapter)for(const method of ['snapshot','readState','writeState'])if(typeof adapter[method]!=='function')throw Error('Scrum adapter: '+method+' が必要です');
 ctx.commands.register({name:'scrum-roles',description:'Scrumの担当役割一覧',handler:()=>({kind:'success',text:JSON.stringify(roles,null,2)})});
 ctx.commands.register({name:'scrum',description:'Scrum: status / start JSON / pause / resume / list / output / delegate / stop / retry',handler:async({rawInput='',agent})=>{
  const match=rawInput.trim().match(/^(status|pause|start|resume|list|output|delegate|stop|retry|task_list|task_get|task_create|task_update|handoff|dag|events|monitor_start|monitor_stop|monitor_list|monitor_output)(?:\s+([\s\S]*))?$/);
  if(!match)return {kind:'success',text:'/scrum status\n/scrum start {"goal":"…","concurrency":2}\n/scrum pause\n/scrum-roles'};
  if(!adapter&&!remote)return {kind:'error',text:'Scrumの実行アダプターが未接続です。実行は開始していません。'};
  try{
   if(remote)return {kind:'success',text:JSON.stringify(await remote(match[1],JSON.parse(match[2]||'{}'),agent?.session.id||process.env.DSH_SESSION_ID),null,2)};
   let state;
   if(match[1]==='start'){
    if(typeof adapter.requestPlan!=='function')throw Error('計画・委譲の接続がありません。実行は開始していません。');
    const input=JSON.parse(match[2]||'{}'),previous=adapter.readState();state=start(adapter,input);
    try{await adapter.requestPlan(state)}catch(error){adapter.writeState(previous);throw error}
   }else state=match[1]==='pause'?pause(adapter):settle(adapter);
   return {kind:'success',text:JSON.stringify(state,null,2)};
  }catch(error){return {kind:'error',text:error.message}}
 }});
 if(remote){
  registerGoalUsage(ctx,remote);
  const {defineTool}=await import('@deepseek-ai/dsh-tools');
  if(lifecycle)ctx.tools.register(defineTool({name:'scrum_lifecycle_status',description:'Read current Scrum version, startup diagnostics, onboarding/advisor marker and update state. This is observational; markers and provider presence do not prove successful authentication.',parameters:{},output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},execute:async(_args,exec)=>JSON.stringify(lifecycle.status(exec.agent?.session.header?.cwd||process.cwd()))}));
  const add=(name,description,method,parameters)=>ctx.tools.register(defineTool({name,description,parameters,output:{schema:{type:'string'},render:(_,value)=>[{type:'text',text:value}]},execute:async(args,exec)=>JSON.stringify(await remote(method,[...teamDagMethods,...threadMethods,...relayMethods,...workflowMethods].includes(method)?args.input:args,exec.agent?.session.id||process.env.DSH_SESSION_ID))}));
  add('native_workflow','Upstream dependency-ordered DAG execution, inspection, retry, amendment, steering and owned cleanup.','native_workflow',{action:{type:'string',required:true},definition:{type:'json'},run_id:{type:'string'},node_ids:{type:'array',items:{type:'string'}},node_id:{type:'string'},message:{type:'string'},prompt:{type:'string'},since_seq:{type:'integer'},limit:{type:'integer'}});
  add('ulw_toolkit','Session-bound HardTackle goal plan, criteria, evidence, steering and checkpoint. operation accepts SDK method names; help lists arguments.','ulw_toolkit',{operation:{type:'string',required:true},args:{type:'json'}});
  add('workpool','Create, push, inspect, close or cancel persistent keyed worker pools; assigned workers yield results.','workpool',{op:{type:'string',required:true,enum:['create','push','inspect','close','cancel','yield']},name:{type:'string'},agent:{type:'json'},mode:{type:'string',enum:['fresh','keep_alive']},tools:{type:'array',items:{type:'string'}},pool_id:{type:'string'},items:{type:'json'},results:{type:'json'}});
  add('background_output','Scrumの担当結果を取得。終了報告と成果物検証済みを区別する。','output',{assignmentId:{type:'string'},task_id:{type:'string'},block:{type:'boolean'},timeout:{type:'integer'},full_session:{type:'boolean'},include_thinking:{type:'boolean'},include_tool_results:{type:'boolean'},message_limit:{type:'integer'},since_message_id:{type:'string'},thinking_max_chars:{type:'integer'},from_end:{type:'boolean'}});
  add('call_omo_agent','探索・資料調査の担当を固定モデルで起動または再利用する。','call_omo_agent',{subagent_type:{type:'string',required:true,enum:['explore','librarian']},prompt:{type:'string',required:true},description:{type:'string'},run_in_background:{type:'boolean'},session_id:{type:'string'},projectId:{type:'string'}});
  add('task','タスクIDを指定して担当へ委譲。却下後は同じtaskIdと既存session_id、修正指示promptで再提出し、新assignmentIdと新hashを収集して確認する。blockedの旧IDを再承認しない。','task',{taskId:{type:'string',required:true},prompt:{type:'string',required:true},category:{type:'string'},subagent_type:{type:'string'},load_skills:{type:'array',items:{type:'string'}},run_in_background:{type:'boolean'},timeout_ms:{type:'integer'},session_id:{type:'string'}});
  add('background_cancel','この親の担当を停止。途中成果と履歴は保持。','background_cancel',{assignmentId:{type:'string'},taskId:{type:'string'},all:{type:'boolean'}});
  add('task_list','この計画の未完了タスクを列挙。','task_list',{all:{type:'boolean'},import_claude:{type:'boolean'},projectId:{type:'string'},reconcile_claude:{type:'json'}});
  add('task_get','タスクの出力・依存関係・完了条件を読む。','task_get',{id:{type:'string',required:true},import_claude:{type:'boolean'},projectId:{type:'string'},reconcile_claude:{type:'json'}});
  add('task_create','親が所有する実行タスクを作成。cwdは親から継承し、本文・出力・完了条件を指定する。','task_create',{projectId:{type:'string'},cwd:{type:'string'},title:{type:'string'},subject:{type:'string'},body:{type:'string'},description:{type:'string'},output:{type:'string'},completionCriteria:{type:'string'},inputs:{type:'string'},dependencies:{type:'array',items:{type:'string'}},blockedBy:{type:'array',items:{type:'string'}},blocks:{type:'array',items:{type:'string'}},addBlockedBy:{type:'array',items:{type:'string'}},addBlocks:{type:'array',items:{type:'string'}}});
  add('task_update','既存タスクの本文・依存関係をバージョン確認付きで変更。version または expected_version が必要。','task_update',{id:{type:'string',required:true},version:{type:'integer'},expected_version:{type:'integer'},title:{type:'string'},subject:{type:'string'},body:{type:'string'},description:{type:'string'},output:{type:'string'},completionCriteria:{type:'string'},inputs:{type:'string'},dependencies:{type:'array',items:{type:'string'}},blockedBy:{type:'array',items:{type:'string'}},blocks:{type:'array',items:{type:'string'}},addBlockedBy:{type:'array',items:{type:'string'}},addBlocks:{type:'array',items:{type:'string'}}});
  for(const method of [...teamDagMethods,...threadMethods,...relayMethods,...workflowMethods])add(method,'Persisted Scrum '+method+(method==='workflow_start'?'. input={mode,goal,stages:[{stage,taskId}],planPath?}; stages must be an array of canonical task references, with later tasks depending on earlier ones.':method==='workflow_checkpoint'?'. input={id,data:{evidence,nextAction}}.':method.startsWith('workflow_')?'. input={id}; workflow_list uses input={}.':''),method,{input:{type:'json',required:true}});
  add('team_send','同じ親の担当に連絡を保存し、担当の待機時に配送。','team_send',{to:{type:'string'},message:{type:'string',required:true},idempotency_key:{type:'string'}});
  add('team_messages','この親のチーム通信を読む。','team_messages',{unread:{type:'boolean'},ack_ids:{type:'array',items:{type:'string'}}});
  add('scrum_handoff','現在の目標・タスク・担当・通知を引継ぎ用に取り出す。','handoff',{});
  add('scrum_dag','依存関係と担当状況のDAGを取得。','dag',{});
  add('monitor_start','指定タスクの成果物と状態の変化を監視し、親へ通知。','monitor_start',{taskId:{type:'string',required:true}});
  add('monitor_stop','この親の監視を停止。','monitor_stop',{id:{type:'string',required:true}});
  add('monitor_list','この親の監視を列挙。','monitor_list',{});
  add('monitor_output','監視の最新観測を取得。','monitor_output',{id:{type:'string',required:true}});
  add('scrum_events','再起動後も再生できる実行イベント。','events',{after:{type:'integer'}});
  add('scrum_status','Scrumの担当・通知・実行状態を取得する。','status',{});
 }
}
