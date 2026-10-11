// Keep the native preset selected before Claude Auto across cold resume.
export function createClaudeModeAdapter(ctx){
 const previousByAgent=new WeakMap(),presets=typeof ctx.get==='function'?ctx.get('permissionPresets'):ctx.permissionPresets;
 const restore=agent=>{if(previousByAgent.has(agent))return previousByAgent.get(agent);const record=agent.session.snapshotEvents?.().filter(event=>event.type==='scrum/claude-auto-previous'&&event.data.ownerSessionId===agent.session.id).at(-1);if(record?.data.active){previousByAgent.set(agent,record.data.previous);return record.data.previous;}};
 const record=(agent,previous,active)=>agent.session.append?.('scrum/claude-auto-previous',{ownerSessionId:agent.session.id,previous,active});
 return (agent,mode)=>{
  let previous=restore(agent);
  if(mode==='auto'){
   if(!presets?.names?.includes('auto'))throw Error('Auto mode requires the native DSH Auto permission provider');
   if(previous===undefined){previous=presets.current(agent.session);if(!presets.names.includes(previous))throw Error('Auto mode cannot safely restore this custom native permission configuration');previousByAgent.set(agent,previous);record(agent,previous,true);}
   presets.set(agent.session,'auto');
  }else if(previous!==undefined){
   if(!presets?.names?.includes(previous))throw Error('Saved native permission preset cannot be restored');
   if(presets.current(agent.session)==='auto')presets.set(agent.session,previous);
   previousByAgent.delete(agent);record(agent,previous,false);
  }
 };
}
