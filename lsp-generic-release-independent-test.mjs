import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {create} from 'tar';
import {selectGenericLspDownload,stageGenericLspRelease} from './independent/lsp-generic-release.mjs';
import {lspInstallRecipe} from './independent/lsp-registry.mjs';
test('generic metadata resolves pinned target and rejects unknown template and unsafe origin',()=>{
 const terraform=selectGenericLspDownload(lspInstallRecipe('terraform-ls'),'terraform-ls',{platform:'darwin',arch:'arm64'});assert.equal(terraform.files[0].url,'https://releases.hashicorp.com/terraform-ls/0.39.0/terraform-ls_0.39.0_darwin_arm64.zip');assert.equal(terraform.executable,'terraform-ls');
 const kotlin=selectGenericLspDownload(lspInstallRecipe('kotlin-lsp'),'intellij-server',{platform:'darwin',arch:'arm64'});assert.equal(kotlin.executable,'kotlin-server-263.6379.0/bin/intellij-server');assert(kotlin.files[0].url.endsWith('-aarch64.sit'));assert.equal(new URL(kotlin.files[0].url).hostname,'download.jetbrains.com');
 const unsafe=lspInstallRecipe('terraform-ls');unsafe.source.download[0].files={'a.zip':'https://127.0.0.1/private'};assert.throws(()=>selectGenericLspDownload(unsafe,'terraform-ls',{platform:'darwin',arch:'arm64'}),/Unapproved/);
 const corrected=selectGenericLspDownload(lspInstallRecipe('kotlin-lsp'),'intellij-server',{platform:'linux',arch:'arm64'});assert.equal(corrected.executable,'kotlin-server-263.6379.0/bin/intellij-server');const broken=lspInstallRecipe('terraform-ls');broken.source.download[0].bin='{{unknown}}';assert.throws(()=>selectGenericLspDownload(broken,'terraform-ls',{platform:'darwin',arch:'arm64'}),/Unsupported/);
});
test('generic staging extracts bounded archive plus adjunct, hashes entry, and blocks private redirect',async t=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-generic-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=join(root,'source');await mkdir(join(source,'bin'),{recursive:true});await writeFile(join(source,'bin/tool'),'#!/bin/sh\nexit 0\n',{mode:0o700});const archive=join(root,'archive.tar.gz');await create({file:archive,gzip:true,cwd:source},['bin']);const bytes=await readFile(archive);
 const recipe={source:{id:'pkg:generic/example/tool@v1',download:[{target:'darwin_arm64',files:{'tool.tar.gz':'https://download.eclipse.org/tool.tar.gz','extra.jar':'https://projectlombok.org/extra.jar'},bin:'bin/tool'}]},bin:{tool:'{{source.download.bin}}'}};
 const stage=join(root,'stage');await mkdir(stage);const result=await stageGenericLspRelease(recipe,{command:['tool']},stage,{cwd:root},{platform:'darwin',arch:'arm64',fetcher:async url=>new Response(url.includes('extra.jar')?'adjunct':bytes)});assert.equal(await readFile(join(stage,result.entry),'utf8'),'#!/bin/sh\nexit 0\n');assert.equal(await readFile(join(stage,'content/extra.jar'),'utf8'),'adjunct');assert.equal(result.entrySha256.length,64);assert.equal(result.release.downloads.length,2);assert.equal(result.release.publishedDigestVerified,false);
 const denied=join(root,'denied');await mkdir(denied);let calls=0;await assert.rejects(stageGenericLspRelease(recipe,{command:['tool']},denied,{cwd:root},{platform:'darwin',arch:'arm64',fetcher:async()=>{calls++;return new Response(null,{status:302,headers:{location:'http://127.0.0.1/'}})}}),/escaped approved/);assert.equal(calls,1);
});

test('Kotlin size allowance is bounded and does not weaken other generic packages or explicit limits',async t=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-kotlin-bound-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const fetcher=async()=>new Response('x',{headers:{'content-length':String(300*1024*1024)}});
 for(const [id,command,pattern,options] of [['terraform-ls','terraform-ls',/exceeds size limit/,{}],['kotlin-lsp','intellij-server',/length mismatch/,{}],['kotlin-lsp','intellij-server',/exceeds size limit/,{maxDownloadBytes:256*1024*1024}]]){
  const stage=await mkdtemp(join(root,'stage-'));await assert.rejects(stageGenericLspRelease(lspInstallRecipe(id),{command:[command]},stage,{cwd:root},{platform:'darwin',arch:'arm64',fetcher,...options}),pattern);
 }
});
