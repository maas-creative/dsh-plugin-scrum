import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
test('shipped audio, web and worktree preferred sources retain exact audited bytes and runnable recipes',async()=>{
 const pkg=JSON.parse(await readFile('package.json','utf8'));
 for(const folder of ['antigravity-source','web-access-source','worktree-source']){
  const root=resolve('vendor',folder),manifest=JSON.parse(await readFile(resolve(root,'source-manifest.json'),'utf8'));
  assert(pkg.files.includes(`vendor/${folder}`));assert.equal(manifest.license,'MIT');assert.equal(manifest.preferredSourceIncluded,true);
  assert(manifest.files.some(f=>f.path.endsWith('.ts')));assert(manifest.files.some(f=>f.path==='rebuild.mjs'));
  for(const file of manifest.files){const path=resolve(root,file.path),rel=relative(root,path);assert(!rel.startsWith('..')&&!rel.startsWith('/'));assert(!(await lstat(path)).isSymbolicLink());assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),file.sha256,file.path);}
 }
 const core=JSON.parse(await readFile('vendor/antigravity-source/core-build-proof.json','utf8'));
 assert.equal(core.exactMatch,true);assert.equal(core.files.length,27);assert(core.files.every(f=>f.match&&f.npmSha256===f.sourceBuildSha256));
});
test('bundled UI schema dependency retains pinned preferred TypeScript source and MIT notice',async()=>{
 const root=resolve('vendor/client-build-source/zod'),manifest=JSON.parse(await readFile(resolve(root,'source-manifest.json'),'utf8'));
 assert.equal(manifest.package,'zod');assert.equal(manifest.version,'4.6.5');assert.equal(manifest.license,'MIT');assert(manifest.files.some(f=>f.path==='LICENSE'));assert(manifest.files.some(f=>f.path==='src/v4/classic/schemas.ts'));
 const pkg=JSON.parse(await readFile('package.json','utf8'));assert.equal(pkg.dependencies.zod,'4.6.5');assert(pkg.files.includes('vendor/client-build-source'));
 for(const file of manifest.files){const path=resolve(root,file.path);assert(!relative(root,path).startsWith('..'));assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'),file.sha256,file.path);}
});
