import {readExecutionState,executionStopped} from './controller.mjs';
export function accountGoalUsage(store,parent,input){
 const {sessionId,seq,kind,inputTokens,outputTokens,elapsedSeconds}=input;
 if(typeof sessionId!=='string'||!Number.isSafeInteger(seq)||seq<0||!['assistant/message','turn/end'].includes(kind))throw Error('Invalid usage event identity');
 const tokensKnown=input.usageAvailable??(kind!=='assistant/message'||inputTokens!==undefined&&outputTokens!==undefined),secondsKnown=input.timeAvailable??(kind!=='turn/end'||elapsedSeconds!==undefined);
 const values=[inputTokens??0,outputTokens??0,elapsedSeconds??0];if(values.some(v=>!Number.isFinite(v)||v<0)||!Number.isInteger(values[0])||!Number.isInteger(values[1])||typeof tokensKnown!=='boolean'||typeof secondsKnown!=='boolean')throw Error('Invalid usage amount');
 store.db.exec('CREATE TABLE IF NOT EXISTS scrum_goal_usage(parent TEXT NOT NULL,started INTEGER NOT NULL,session TEXT NOT NULL,seq INTEGER NOT NULL,kind TEXT NOT NULL,tokens INTEGER NOT NULL,seconds REAL NOT NULL,PRIMARY KEY(parent,started,session,seq,kind))');
 const columns=store.all('PRAGMA table_info(scrum_goal_usage)').map(row=>row.name);for(const name of ['tokensKnown','secondsKnown'])if(!columns.includes(name))store.db.exec('ALTER TABLE scrum_goal_usage ADD COLUMN '+name+' INTEGER NOT NULL DEFAULT 1');
 return store.tx(()=>{
  const state=readExecutionState(store,parent);if(!state.goal||!state.startedAt||state.active===false||executionStopped(state)||state.phase==='blocked')return state;
  const keys=[parent,state.startedAt,sessionId,seq,kind],old=store.get('SELECT * FROM scrum_goal_usage WHERE parent=? AND started=? AND session=? AND seq=? AND kind=?',...keys);
  const tokens=tokensKnown?values[0]+values[1]:0,seconds=secondsKnown?values[2]:0;
  if(old&&(old.tokensKnown||!tokensKnown)&&(old.secondsKnown||!secondsKnown))return state;
  const nextTokens=old?.tokensKnown?old.tokens:tokens,nextSeconds=old?.secondsKnown?old.seconds:seconds;
  if(old)store.run('UPDATE scrum_goal_usage SET tokens=?,seconds=?,tokensKnown=?,secondsKnown=? WHERE parent=? AND started=? AND session=? AND seq=? AND kind=?',nextTokens,nextSeconds,Number(Boolean(old.tokensKnown||tokensKnown)),Number(Boolean(old.secondsKnown||secondsKnown)),...keys);
  else store.run('INSERT INTO scrum_goal_usage(parent,started,session,seq,kind,tokens,seconds,tokensKnown,secondsKnown) VALUES(?,?,?,?,?,?,?,?,?)',...keys,tokens,seconds,Number(tokensKnown),Number(secondsKnown));
  const unavailable=store.get('SELECT COUNT(*) count FROM scrum_goal_usage WHERE parent=? AND started=? AND (tokensKnown=0 OR secondsKnown=0)',parent,state.startedAt).count;
  const next={...state,tokensUsed:(state.tokensUsed||0)+nextTokens-(old?.tokens||0),timeUsedSeconds:(state.timeUsedSeconds||0)+nextSeconds-(old?.seconds||0),usageAvailability:unavailable?'incomplete':'available',usageUnavailableEvents:unavailable};store.set('ulw:'+parent,next);return next;
 });
}
export function registerGoalUsage(ctx,remote){
 const pending=new Set();
 ctx.on('session/event',(session,event)=>{
  if(!['assistant/message','turn/end'].includes(event.type))return;
  const usage=event.data.usage,start=event.type==='turn/end'?session.snapshotEvents().find(e=>e.type==='turn/start'&&e.data.turn===event.data.turn):null;
  const usageAvailable=event.type!=='assistant/message'||Boolean(usage&&Number.isSafeInteger(usage.inputTokens)&&usage.inputTokens>=0&&Number.isSafeInteger(usage.outputTokens)&&usage.outputTokens>=0),timeAvailable=event.type!=='turn/end'||Boolean(start&&Number.isFinite(event.time)&&Number.isFinite(start.time)&&event.time>=start.time);
  const args={sessionId:session.id,seq:event.seq,kind:event.type,usageAvailable,timeAvailable,...(event.type==='assistant/message'&&usageAvailable?{inputTokens:usage.inputTokens,outputTokens:usage.outputTokens}:{}),...(event.type==='turn/end'&&timeAvailable?{elapsedSeconds:(event.time-start.time)/1000}:{})};
  if(!usageAvailable||!timeAvailable)ctx.logger?.warn('Goal usage unavailable for '+session.id+' event '+event.seq);
  const work=Promise.resolve().then(()=>remote('goal_usage',args,session.id)).catch(error=>ctx.logger?.warn('Goal usage recording failed: '+error.message)).finally(()=>pending.delete(work));pending.add(work);
 });
 ctx.effect?.(()=>async()=>{await Promise.allSettled([...pending])});
}
