import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm,symlink} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createRequire} from 'node:module';
import {LSP_MCP_TOOLS,parseLspRequestContext,runWithRequestContext} from './independent/lsp-tools.mjs';import {getLspManager} from './independent/lsp-client.mjs';
const require=createRequire(import.meta.url),tool=(name,args)=>LSP_MCP_TOOLS.find(t=>t.name===name).execute(args,new AbortController().signal);
test('independent LSP query tools use actual TypeScript definition, references, symbols and status',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'scrum-own-lsp-tools-'));try{
  const config=join(cwd,'lsp.json'),file=join(cwd,'a.ts');await writeFile(file,'const value = 1;\nconsole.log(value);\n');await writeFile(join(cwd,'tsconfig.json'),'{}');await writeFile(config,JSON.stringify({lsp:{typescript:{command:[process.execPath,join(require.resolve('typescript-language-server/package.json'),'..','lib','cli.mjs'),'--stdio'],extensions:['.ts']}}}));
  await runWithRequestContext(parseLspRequestContext({cwd,userConfigPath:config}),async()=>{
   const args={filePath:file,line:2,character:13};const definition=await tool('goto_definition',args);assert.ok(definition.details.locations?.length);const references=await tool('find_references',args);assert.equal(references.details.references.length,2);const symbols=await tool('symbols',{filePath:file,scope:'document'});assert.ok(symbols.details.symbols.length);assert.equal((await tool('status',{})).details.snapshots.find(s=>s.id==='typescript').running,true);await assert.rejects(tool('find_references',{...args,line:0}),/Invalid/);await writeFile(file,'const value: number = \"wrong\";\n');let diagnostic;const until=Date.now()+5000;do{diagnostic=await tool('diagnostics',{filePath:file,severity:'error'});if(diagnostic.details.diagnostics.some(d=>d.code===2322))break;await new Promise(resolve=>setTimeout(resolve,50));}while(Date.now()<until);assert.equal(diagnostic.details.pending,false);assert.ok(diagnostic.details.diagnostics.some(d=>d.code===2322));
  });
 }finally{await getLspManager().stopAll();await rm(cwd,{recursive:true,force:true});}
});
test('independent LSP installation decisions preserve saved fields and refuse disabled capability and symlink',async()=>{
 const cwd=await mkdtemp(join(tmpdir(),'scrum-own-lsp-decisions-'));try{
  const path=join(cwd,'decisions.json'),saved={typescript:{decision:'declined',decidedAt:'2020-01-01T00:00:00.000Z'}};await writeFile(path,JSON.stringify(saved));
  const context=parseLspRequestContext({cwd,installDecisionsPath:path,capabilities:{installDecisionTool:true}});
  await runWithRequestContext(context,()=>tool('install_decision',{server_id:'pyright',decision:'allowed'}));const data=JSON.parse(await readFile(path,'utf8'));assert.deepEqual(data.typescript,saved.typescript);assert.equal(data.pyright.decision,'allowed');assert.ok(Date.parse(data.pyright.decidedAt));
  await assert.rejects(runWithRequestContext({...context,capabilities:{}},()=>tool('install_decision',{server_id:'pyright',decision:'declined'})),/not permitted/);
  const link=join(cwd,'linked.json');await symlink(path,link);await assert.rejects(runWithRequestContext({...context,installDecisionsPath:link},()=>tool('install_decision',{server_id:'pyright',decision:'declined'})),/Unsafe/);
 }finally{await rm(cwd,{recursive:true,force:true});}
});
