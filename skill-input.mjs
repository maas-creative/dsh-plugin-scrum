import {markSkillLoaded} from './skill-load-state.mjs';
// Pinned OMO skill-commands and skill-pointers semantics; native host resolves bodies.
const builtinCommandSkills=new Set(['refactor','ulw-execute','remove-ai-slops','handoff','hyperplan']);
const mask=region=>region.replace(/[^\r\n]/g,'\0');
export function visibleSkillInput(text){
 let visible=text.replace(/<(omo-[a-z0-9-]+-pointer|ultrawork-mode|omo-ultrawork-reminder)>[\s\S]*?<\/\1>/gi,mask);
 const fences=/^ {0,3}(`{3,}|~{3,})[^\n]*(?:\n|$)/gm;for(let opening;(opening=fences.exec(visible));){const fence=opening[1],endPattern=new RegExp('^ {0,3}'+fence[0]+'{'+fence.length+',}[ \\t]*\\r?$','gm');endPattern.lastIndex=fences.lastIndex;const closing=endPattern.exec(visible),end=closing?endPattern.lastIndex:visible.length;visible=visible.slice(0,opening.index)+mask(visible.slice(opening.index,end))+visible.slice(end);fences.lastIndex=end;}
 return visible.replace(/(?<!`)(`+)(?!`)[\s\S]*?(?<!`)\1(?!`)/g,mask).replace(/^\s*>.*$/gm,mask);
}
export function resolveSkillInput(text,{available=[],disabled=[],hostCommands=[],disabledCommands=[],source='interactive'}={}){
 if(source==='extension')return {text,names:[]};const availableNames=new Set(available.map(s=>typeof s==='string'?s:s.name)),blocked=new Set(disabled),bare=text.match(/^\/([a-z0-9][a-z0-9-]*)(?=\s|$)/);
 if(bare&&builtinCommandSkills.has(bare[1])&&disabledCommands.includes(bare[1]))return {text,names:[],unavailable:[bare[1]],disabledCommand:true};
 if(bare&&availableNames.has(bare[1])&&!hostCommands.some(c=>(typeof c==='string'?c:c.name)===bare[1]))text='/skill:'+text.slice(1);
 const visible=visibleSkillInput(text),explicit=visible.match(/^\/skill:([a-z0-9][a-z0-9-]*)(?=\s|$)/)?.[1],mass='(?:mass[\\s-]*ulw|ulw[\\s-]*mass|mulw|meth)',targets=[['mass-ulw',new RegExp('\\b'+mass+'\\b','i')],['ulw-plan',/\bulw[\s-]*plan\b/i],['ulw-loop',/\bulw[\s-]*loop\b/i],['ulw-research',new RegExp('\\b(?:ulw|'+mass+')[\\s-]*research\\b','i')]];
 const requested=new Set(explicit?[explicit]:[]);for(const [name,pattern]of targets)if(pattern.test(visible))requested.add(name);if(requested.has('ulw-research'))requested.add('ultimate-browsing');
 const unavailable=[...requested].filter(name=>blocked.has(name)||!availableNames.has(name)),names=[...requested].filter(name=>!unavailable.includes(name)&&!new RegExp('<skill\\s+name="'+name+'"','i').test(text));
 return {text,names,unavailable};
}
export async function registerSkillInputs(ctx){
 const {loadScrumConfiguration,configurationAllows}=await import('./configuration.mjs'),{createUserMessage}=await import('@deepseek-ai/dsh-llm');
 const options=agent=>({cwd:agent?.session?.header.cwd||process.env.DSH_WORK_CWD||process.cwd(),scope:agent});
 const block=skill=>'<skill name="'+skill.name+'">\nResource base: '+JSON.stringify(skill.resourceBase||null)+'\n'+skill.content+'\n</skill>';
 const initial=await ctx.skills.list(options());
 for(const summary of initial){if(!summary.invocation?.userInvocable||ctx.commands.list().some(c=>c.name===summary.name))continue;
  ctx.commands.register({name:summary.name,description:summary.description,handler:async({agent,rawInput=''})=>{if(!agent)return {kind:'error',text:'Skill requires an agent session'};try{const view=options(agent),config=loadScrumConfiguration({cwd:view.cwd}).config;if(builtinCommandSkills.has(summary.name)&&!configurationAllows(config,'commands',summary.name))throw Error('Builtin command disabled: '+summary.name+'; explicit /skill:'+summary.name+' remains governed by disabled_skills');if(config.disabled_skills?.includes(summary.name))throw Error('Skill disabled: '+summary.name);const skill=await ctx.skills.get(summary.name,view);if(!skill?.invocation?.userInvocable)throw Error('Skill unavailable: '+summary.name);const resolution=resolveSkillInput('/skill:'+summary.name+' '+rawInput,{available:await ctx.skills.list(view),disabled:config.disabled_skills});const skills=await Promise.all(resolution.names.map(name=>ctx.skills.get(name,view)));agent.followup(createUserMessage({content:[{type:'text',text:skills.filter(Boolean).map(block).join('\n\n')+'\n\n'+rawInput}],source:{kind:'user'}}));for(const loaded of skills.filter(Boolean))markSkillLoaded(agent,loaded.name);return {kind:'success',text:'Skill queued: '+summary.name}}catch(error){return {kind:'error',text:error.message}}}});
 }
 ctx.on('system-prompt/assemble',async(assembly,input,next)=>{
  const prior=await next(),agent=input.agent||input.scope;if(!agent?.session)return prior;
  const latest=agent.session.snapshotEvents?.().filter(e=>e.type==='user/message'&&e.data.source?.kind==='user').at(-1)?.data;
  if(!latest)return prior;const text=latest.content?.filter(b=>b.type==='text').map(b=>b.text).join('\n')||'',view=options(agent),config=loadScrumConfiguration({cwd:view.cwd}).config,available=await ctx.skills.list(view),resolution=resolveSkillInput(text,{available,disabled:config.disabled_skills,disabledCommands:config.disabled_commands});
  const skills=[];for(const name of resolution.names){const skill=await ctx.skills.get(name,view);if(skill?.invocation?.userInvocable)skills.push(skill)}
  for(const skill of skills)markSkillLoaded(agent,skill.name);const contexts=prior.contexts.filter(c=>!c.name.startsWith('scrum:skill-input:'));return {...prior,contexts:[...contexts,...skills.map(skill=>({name:'scrum:skill-input:'+skill.name,text:block(skill)}))]};
 });
}
