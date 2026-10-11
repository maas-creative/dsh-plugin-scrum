import {realpathSync,readFileSync,statSync} from 'node:fs';
import {createAgentToolkit,ULW_LOOP_MANIFEST,ulwLoopGoalsPath} from './independent/goal-toolkit.mjs';
import {executionStopped} from './controller.mjs';
const locks=new WeakMap();
export async function handleUlwToolkit(runtime,{args={},parentSession,callerSession}){
 if(!parentSession||callerSession&&callerSession!==parentSession)throw Error('HardTackle toolkit operations are lead-only');
 const operation=ULW_LOOP_MANIFEST.operations.find(item=>item.name===args.operation||item.method===args.operation);
 if(!operation)throw Error('Unknown HardTackle toolkit operation');
 if(operation.mutating&&executionStopped(runtime.state(parentSession)))throw Error('Stopped parent cannot mutate HardTackle plan');
 const row=runtime.s.get('SELECT cwd FROM runs WHERE id=?',parentSession);
 const ownedCwd=row?.cwd||runtime.parentCwd?.(parentSession);
 if(!ownedCwd)throw Error('ULW parent workspace is not registered');
 const cwd=realpathSync(ownedCwd),input=args.args||{};
 if(typeof input!=='object'||Array.isArray(input))throw Error('HardTackle toolkit arguments must be an object');
 for(const field of ['cwd','sessionId','surface'])if(field in input)throw Error('ULW binding is owned by the host');
 let sessions=locks.get(runtime);if(!sessions)locks.set(runtime,sessions=new Map());
 const prior=sessions.get(parentSession)||Promise.resolve();
 const run=prior.catch(()=>{}).then(async()=>{
  const toolkit=createAgentToolkit({cwd,sessionId:parentSession,surface:'omo-senpi'});
  const saved=runtime.s.setting('scrumUlwToolkit:'+parentSession,null);
  if(operation.mutating)runtime.s.set('scrumUlwToolkit:'+parentSession,{cwd,sessionId:parentSession,pending:true,updated:Date.now()});
  const response=await toolkit.dispatch({operation:operation.name,args:input});
  if(operation.mutating){const status=await toolkit.status();if(!status.ok)runtime.s.set('scrumUlwToolkit:'+parentSession,saved);if(status.ok)runtime.s.set('scrumUlwToolkit:'+parentSession,{cwd,sessionId:parentSession,plan:status.result.plan,summary:status.result.summary,updated:Date.now()});}
  return response;
 });sessions.set(parentSession,run);
 try{return await run}finally{if(sessions.get(parentSession)===run)sessions.delete(parentSession)}
}
export function ulwToolkitWorkflows(store,parent){
 const saved=store.setting('scrumUlwToolkit:'+parent,null);if(!saved)return [];
 try{const file=ulwLoopGoalsPath(saved.cwd,{sessionId:parent});if(statSync(file).size>4*1024*1024)throw Error('HardTackle plan exceeds 4MB');const plan=JSON.parse(readFileSync(file,'utf8'));if(!Array.isArray(plan.goals)||!plan.goals.length)throw Error('Invalid ULW goal plan');return [{id:'ulw-toolkit:'+parent,status:plan.aggregateCompletion?.status==='complete'?'done':'active',mode:'ulw-loop',goal:plan.codexObjective,goals:plan.goals}];}
 catch(error){return [{id:'ulw-toolkit:'+parent,status:'blocked',mode:'ulw-loop',error:error.message}];}
}
