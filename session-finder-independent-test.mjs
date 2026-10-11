import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';
const cli=new URL('./vendor/session-finder-independent/runtime/cli.mjs',import.meta.url).href;
test('MIT session finder lists and searches local pi records and reads matched events without remote access',()=>{
 const root=mkdtempSync(join(tmpdir(),'scrum-finder-fixture-'));const home=join(root,'home');mkdirSync(home);
 mkdirSync(join(root,'sessions'));const file=join(root,'sessions','fixture.jsonl');writeFileSync(file,[{type:'session',id:'scrum-pi-fixture',cwd:'/fixture',timestamp:'2026-10-10T00:00:00Z'},{type:'message',message:{role:'user',content:[{type:'text',text:'Finish unique-scrum-migration'}]}},{type:'message',message:{role:'assistant',content:[{type:'text',text:'Acceptance artifact unique-scrum-output'}],model:'gpt-6.1-sol',provider:'openai'}}].map(x=>JSON.stringify(x)).join('\n')+'\n');
 const invoke=args=>JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`const {run}=await import(${JSON.stringify(cli)});process.exitCode=await run(${JSON.stringify(args)});`],{env:{...process.env,HOME:home,USERPROFILE:home},encoding:'utf8'}));
 try{const listed=invoke(['list','--root',root,'--platform','senpi']);assert.match(JSON.stringify(listed),/scrum-pi-fixture/);const found=invoke(['find','--root',root,'--platform','senpi','--query','unique-scrum-output']);assert.match(JSON.stringify(found),/unique-scrum-output/);const read=invoke(['read','scrum-pi-fixture','--root',root,'--platform','senpi','--grep','unique-scrum-output']);assert.match(JSON.stringify(read),/matched_events/);assert.match(JSON.stringify(read),/unique-scrum-output/)}finally{rmSync(root,{recursive:true,force:true})}
});

 test('MIT finder adaptation preserves default OMP and Gajae platform identities and histories',()=>{
  const home=mkdtempSync(join(tmpdir(),'scrum-omp-gjc-fixture-'));
  try{
   for(const [folder,platform] of [['omp','oh-my-pi'],['gjc','gajae-code']]){
    const dir=join(home,'.'+folder,'agent','sessions','fixture');mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'fixture.jsonl'),JSON.stringify({type:'session',id:platform+'-fixture',timestamp:'2026-10-10T00:00:00Z',cwd:'/fixture'})+'\n'+JSON.stringify({type:'message',message:{role:'user',content:[{type:'text',text:'Synthetic '+platform}]}})+'\n');
    const args=['list','--platform',platform];const listed=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',`const {run}=await import(${JSON.stringify(cli)});process.exitCode=await run(${JSON.stringify(args)});`],{env:{...process.env,HOME:home,USERPROFILE:home},encoding:'utf8'}));
    assert.equal(listed.count,1);assert.equal(listed.results[0].platform,platform);assert.equal(listed.results[0].id,platform+'-fixture');
   }
  }finally{rmSync(home,{recursive:true,force:true})}
 });
