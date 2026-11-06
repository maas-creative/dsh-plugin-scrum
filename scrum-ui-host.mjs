import {Remote,TypertRemoteService} from '@deepseek-ai/dsh-typert-protocol';
import {roles,workerRoles} from './roles.mjs';
import {saveModel,defaultModel} from './models.mjs';

// Public Remote markers use the SDK's decorator API, without a transpilation step.
const initializers=[];
export class ScrumUiService extends TypertRemoteService {
 constructor(ctx,remote,runtime){super(ctx,'scrumUi');this.remote=remote;this.runtime=runtime;for(const initialize of initializers)initialize.call(this);}
 async snapshot(agent){
  if(!agent?.session?.id)throw Error('A selected session is required');
  if(!this.remote)return {connected:false,sessionId:agent.session.id};
  const state=await this.remote('status',{},agent.session.id);
  return {...state,connected:true,sessionId:agent.session.id};
 }
 async action(agent,verb){
  if(!agent?.session?.id||!this.remote)throw Error('Scrum execution runtime required');
  const command=new Map([['enable','/hdt'],['stop','/stop-continuation'],['resume','/resume-continuation']]).get(verb);
  if(!command)throw Error('Unknown Scrum action');
  const execution=await this.ctx.commands.execute(agent,command,[],this.ctx.invocation?.signal||new AbortController().signal);
  if(execution?.result?.kind!=='success')throw Error(execution?.result.text||'Scrum command failed');
  return this.snapshot(agent);
 }
 async settings(){
  const catalog=[];
  for(const provider of this.ctx.llm.listProviders()){
   const id=provider.id||provider.name||provider.provider;
   if(!id)continue;
   try{
    const models=[];
    for(const m of await this.ctx.llm.listModels(id)){
     let reasoningEfforts=Array.isArray(m.reasoningEfforts)?m.reasoningEfforts:[];
     try{const info=await this.ctx.llm.resolveModelInfo(id,m.id);if(Array.isArray(info?.reasoning?.efforts))reasoningEfforts=info.reasoning.efforts.map(e=>typeof e==='string'?e:e.id).filter(Boolean)}catch{}
     models.push({id:m.id,name:m.name||m.id,reasoningEfforts:[...new Set(reasoningEfforts)]});
    }
    catalog.push({provider:id,models});
   }catch{catalog.push({provider:id,models:[],unavailable:true})}
  }
  const models=this.runtime?.s.setting('workerModels',{default:defaultModel})||{default:defaultModel};
  return {roles:workerRoles(models),mainWorker:models.main||models.default||defaultModel,models,catalog,writable:!!this.runtime?.s};
 }
 async saveModel(body){
  if(!this.runtime?.s)throw Error('Model settings are owned by the connected Scrum host');
  if(!body||typeof body!=='object'||Array.isArray(body)||body.taskId||body.category||body.fallbacks)throw Error('This settings page accepts one role or the default model');
  if(body.role!==undefined&&(typeof body.role!=='string'||(body.role&&body.role!=='main'&&!Object.hasOwn(roles,body.role))))throw Error('Unknown Scrum role');
  const config=await this.settings();
  saveModel(this.runtime.s,{role:body.role,reset:body.reset,model:body.model},config.catalog);
  return this.settings();
 }
}
for(const name of ['snapshot','action','settings','saveModel'])Remote(ScrumUiService.prototype[name],{kind:'method',name,static:false,private:false,addInitializer:fn=>initializers.push(fn)});
export function registerScrumUi(ctx,remote,runtime){return new ScrumUiService(ctx,remote,runtime);}
