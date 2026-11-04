import * as sessionApi from '@deepseek-ai/dsh-session';
const prefix='plugin:dsh-plugin-scrum/';
export function scrumEventType(type){return typeof type==='string'&&type.startsWith(prefix)?'scrum/'+type.slice(prefix.length):type}
export function appendScrumEvent(session,type,data){
 if(sessionApi.appendPluginRecord&&session instanceof sessionApi.Session)return sessionApi.appendPluginRecord(session,prefix+type.slice('scrum/'.length),data);
 return session.append?.(type,data);
}
