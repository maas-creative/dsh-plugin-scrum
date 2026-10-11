// Timers are owned by a session; any observed activity invalidates pending delivery.
export function createIdleNotificationScheduler({ctx,config,hasIncompleteTodos,send}){
 const sessions=new Map();
 function entry(id){if(!sessions.has(id))sessions.set(id,{epoch:0,lastActivity:0,timer:null});return sessions.get(id);}
 function deleteSession(id){const item=sessions.get(id);if(item){item.epoch++;clearTimeout(item.timer);sessions.delete(id);}}
 function markSessionActivity(id){const item=entry(id);item.epoch++;item.lastActivity=Date.now();clearTimeout(item.timer);item.timer=null;}
 function scheduleIdleNotification(id){const item=entry(id);clearTimeout(item.timer);const epoch=++item.epoch;const delay=Math.max(config.idleConfirmationDelay,config.activityGracePeriodMs-(Date.now()-item.lastActivity));
 item.timer=setTimeout(async()=>{item.timer=null;try{if(config.skipIfIncompleteTodos&&await hasIncompleteTodos(ctx,id))return;if(sessions.get(id)!==item||item.epoch!==epoch)return;await send(ctx,id);}catch(error){ctx.logger?.warn('Scrum idle notice failed: '+error.message);}},Math.max(0,delay));item.timer.unref?.();
 while(sessions.size>config.maxTrackedSessions)deleteSession(sessions.keys().next().value);
 }
 return {deleteSession,markSessionActivity,scheduleIdleNotification};
}
