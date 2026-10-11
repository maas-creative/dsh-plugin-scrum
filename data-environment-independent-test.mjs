import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,chmodSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawnSync} from 'node:child_process';
import {ensurePythonDependencies,ensureJavaScriptDependencies,setupUv,findExecutable} from './independent/data-environment.mjs';
function fixture(t){const root=mkdtempSync(join(tmpdir(),'scrum-data-setup-'));t.after(()=>rmSync(root,{recursive:true,force:true}));return root;}
test('existing Python cache returns exact versioned import path without installing packages',t=>{
 const root=fixture(t),target=join(root,'py-cp312');for(const name of ['polars','pyarrow'])mkdirSync(join(target,name),{recursive:true});let installed=false;
 const result=ensurePythonDependencies(process.execPath,{env:{...process.env,SCRUM_DATA_SCIENTIST_CACHE_ROOT:root},run:(_command,args)=>{if(args[0]==='pip')installed=true;return args.includes(target)?'':'cp312\n'}});assert.equal(result,target);assert.equal(installed,false);
});
test('missing Python executable fails before changing environment',t=>{
 const root=fixture(t);assert.throws(()=>ensurePythonDependencies('/nonexistent/scrum-python',{env:{SCRUM_DATA_SCIENTIST_CACHE_ROOT:join(root,'unused')}}),/not found/);
});
test('existing JavaScript module is loaded before accepting its cache path and does not need a package manager',t=>{
 const root=fixture(t),file=join(root,'node_modules/@duckdb/node-api/lib/index.js');mkdirSync(join(root,'node_modules/@duckdb/node-api/lib'),{recursive:true});writeFileSync(file,'exports.DuckDBInstance=class DuckDBInstance {};\n');assert.equal(ensureJavaScriptDependencies({env:{PATH:'',SCRUM_DATA_SCIENTIST_CACHE_ROOT:root}}),file);
});
test('UV fresh installer uses official endpoint, isolates temporary file and preserves shell profiles',async t=>{
 const root=fixture(t),install=join(root,'uv-bin');let downloaded=false;const calls=[];
 const result=await setupUv({env:{PATH:'',HOME:root,UV_INSTALL_DIR:install},fetch:async url=>{assert.equal(url,'https://astral.sh/uv/install.sh');downloaded=true;return new Response('official installer fixture');},run:(command,args,options)=>{calls.push({command,args,env:options.env});if(command==='/bin/sh'){mkdirSync(install);writeFileSync(join(install,'uv'),'fixture');return '';}return 'uv fixture-version\n';}});
 assert(downloaded);assert.equal(result.executable,join(install,'uv'));assert(calls.every(call=>call.env.UV_NO_MODIFY_PATH==='1'));
});
test('shell entry help does not install or create a dependency cache',t=>{
 const root=fixture(t),result=spawnSync('/bin/sh',['skills/data-scientist/scripts/ensure-py-deps.sh','--help'],{env:{...process.env,SCRUM_DATA_SCIENTIST_CACHE_ROOT:join(root,'unused')},encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/python-executable/);
});

test('executable lookup rejects directories, nonexecutables and empty PATH components',t=>{
 const root=fixture(t);mkdirSync(join(root,'uv'));writeFileSync(join(root,'python'),'fixture');
 assert.equal(findExecutable('uv',{env:{PATH:root}}),null);assert.equal(findExecutable('python',{env:{PATH:root}}),null);
 chmodSync(join(root,'python'),0o700);assert.equal(findExecutable('python',{env:{PATH:root}}),join(root,'python'));
 assert.equal(findExecutable('package.json',{env:{PATH:''}}),null);
});
test('Windows npm launcher executes its Node CLI without a command shell',t=>{
 const root=fixture(t),bin=join(root,'bin'),cache=join(root,'cache');mkdirSync(join(bin,'node_modules/npm/bin'),{recursive:true});writeFileSync(join(bin,'npm.cmd'),'fixture');const cli=join(bin,'node_modules/npm/bin/npm-cli.js');writeFileSync(cli,'fixture');let installed=false;
 const file=ensureJavaScriptDependencies({platform:'win32',env:{PATH:bin,SCRUM_DATA_SCIENTIST_CACHE_ROOT:cache},run:(command,args)=>{if(args[0]===cli){assert.equal(command,process.execPath);installed=true;const module=join(cache,'node_modules/@duckdb/node-api/lib/index.js');mkdirSync(join(cache,'node_modules/@duckdb/node-api/lib'),{recursive:true});writeFileSync(module,'fixture');}return '';}});
 assert(installed);assert.match(file,/index.js$/);
});
