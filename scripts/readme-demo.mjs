// Copyright (c) 2026 MaaS Creative. SPDX-License-Identifier: AGPL-3.0-only
// Isolated DSH Web display fixture. It seeds one blocked worker; no model runs.
import {createUserMessage} from '@deepseek-ai/dsh-llm';
import {spawn} from 'node:child_process';
import {mkdir,mkdtemp,realpath,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const own=fileURLToPath(import.meta.url),root=resolve(import.meta.dirname,'..');
export const name='scrum-documentation-demo';
export const inject=['skills','commands','tools','fs','systemPrompt','sessionPersistence','attachments','llm','agents','sessions','goals','sessionProjections','sandbox','sandboxPolicy','credentials','compaction','loader','workspaceRegistry','scrumUi'];
export function apply(ctx){
 const timer=setTimeout(async()=>{
  try{
   await ctx.get('loader').await();
   const dir=process.env.SCRUM_UI_RUN_DIR,runtime=ctx.scrumUi.runtime;
   const handle=await ctx.agents.create({sessionId:randomUUID(),agentOptions:{provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'low'},meta:{cwd:dir},setup:(_,agent)=>{agent.followup=()=>{}}});
   ctx.effect(()=>()=>handle.dispose());
   const parent=handle.agent.session.id;
   const taskId=runtime.s.task({parentSession:parent,cwd:dir,title:'Review release notes',body:'Documentation display sample; no model executed',output:'fixture.md',completionCriteria:'Review source material',status:'todo'});
   const id=randomUUID(),now=Date.now();
   const a={id,taskId,parentSession:parent,runId:null,taskVersion:1,status:'blocked',role:'reviewer',model:{provider:'openai-codex',model:'gpt-6.1-sol',reasoningEffort:'low'},error:'Waiting for source material',result:'Draft review saved; source confirmation required',artifact:{path:join(dir,'fixture.md'),hash:'0'.repeat(64)},created:now};
   runtime.s.run('INSERT INTO assignments VALUES(?,?,?,?,?,?,?,?,?)',id,taskId,parent,null,1,'blocked',JSON.stringify(a),now,now);
   handle.agent.session.append('user/message',createUserMessage({content:[{type:'text',text:'Documentation sample: review the release notes and show the assigned reviewer. No model execution.'}],source:{kind:'user'}}),{surfaceOp:'append'});
   await ctx.commands.execute(handle.agent,'/scrum-panel',[],new AbortController().signal);
   await ctx.sessions.flush(handle.agent.session);
   const workspace=await ctx.workspaceRegistry.create(dir,'Documentation sample');
   await workspace.attachSession(parent);
   await writeFile(join(dir,'ready.json'),JSON.stringify({parentSessionId:parent,fixture:true,modelCalls:0}));
  }catch(error){
   await writeFile(join(process.env.SCRUM_UI_RUN_DIR,'error.txt'),error.stack);
   console.error('Documentation fixture failed:',error.message);
  }
 },100);
 ctx.effect(()=>()=>clearTimeout(timer));
}
if(process.env.SCRUM_UI_COMPANION!=='1'){
 const require=createRequire(own),cli=join(require.resolve('@deepseek-ai/dsh/package.json'),'../lib/bin.js');
 // Canonical paths keep DSH sessions and workspace registration on the same root.
 const dir=await realpath(await mkdtemp(join(tmpdir(),'scrum-docs-'))),home=join(dir,'home');
 await mkdir(join(home,'profiles/web/node_modules'),{recursive:true});
 await symlink(root,join(home,'profiles/web/node_modules/dsh-plugin-scrum'));
 await writeFile(join(home,'profiles/web/package.json'),JSON.stringify({name:'scrum-docs-web',private:true,dependencies:{'dsh-plugin-scrum':'file:'+root},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-plugin-scrum']}}}));
 const patch=join(dir,'patch.yml');
 await writeFile(patch,`- id: llm-pi-ai
  config:
    providers:
      openai-codex:
        reasoning: low
        models:
          - id: gpt-6.1-sol
            input: [text, image]
            contextWindow: 1048576
            maxTokens: 32768
            reasoningEfforts:
              low: low
- id: tool-web
  disabled: true
- id: scrum
  config:
    standalone:
      dataDir: ${JSON.stringify(join(dir,'scrum'))}
      intervalMs: 0
    lifecycle:
      onboardingDisabled: true
      interactive: false
      telemetry:
        enabled: false
- insert:
    - id: demo-compaction
      name: ${JSON.stringify(require.resolve('@deepseek-ai/dsh-compaction-basic'))}
    - id: documentation-demo
      name: ${JSON.stringify(own)}
`);
 const child=spawn(process.execPath,[cli,'--profile','web','--patch',patch,'--no-open','--host','127.0.0.1','--port','0'],{cwd:dir,env:{...process.env,HOME:home,DSH_HOME:home,DSH_WORK_CWD:dir,DSH_SCRUM_SOCKET:'',DSH_SCRUM_TOKEN:'',SCRUM_UI_COMPANION:'1',SCRUM_UI_RUN_DIR:dir},stdio:['ignore','inherit','inherit']});
 child.once('error',async error=>{console.error(error.message);await rm(dir,{recursive:true,force:true});process.exitCode=1});
 child.once('exit',async code=>{await rm(dir,{recursive:true,force:true});process.exitCode=code??0});
 for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>child.kill(signal));
}
