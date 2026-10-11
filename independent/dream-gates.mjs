// Scrum maintenance admission: user requests bypass automatic scheduling gates.
export const DEFAULT_DREAM_TRIGGER_SETTINGS=Object.freeze({enabled:true,idleMinutes:30,minHoursBetween:24,shutdownLaunch:true,autoSelectMax:5,autoSelectMaxChars:150000});
export async function evaluateDreamGates(origin,settings,probe){
 if(origin==='manual')return {allowed:true};
 if(!['idle','shutdown','pressure'].includes(origin))return {allowed:false,rejection:'invalid_origin'};
 if(!settings.enabled)return {allowed:false,rejection:'disabled'};
 if(origin==='shutdown'&&!settings.shutdownLaunch)return {allowed:false,rejection:'shutdown_disabled'};
 const last=await probe.lastDreamAtMs();
 if(last!==null&&last!==undefined&&probe.nowMs-last<=settings.minHoursBetween*3600000)return {allowed:false,rejection:'too_soon'};
 if(origin!=='pressure'&&await probe.unreflectedBytes()<=8192)return {allowed:false,rejection:'insufficient_volume'};
 return {allowed:true};
}
