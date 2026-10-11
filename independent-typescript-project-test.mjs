import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';import {createProject} from './skills/programming/scripts/typescript/new-project.ts';
test('independent TypeScript generator preserves Bun scripts and existing user projects',async()=>{
 const root=await mkdtemp(join(tmpdir(),'scrum-ts-scaffold-'));
 try{const target=createProject('fixture',root),manifest=JSON.parse(await readFile(join(target,'package.json'),'utf8'));assert.equal(manifest.scripts.start,'bun src/index.ts');assert.ok(manifest.dependencies.hono);assert.ok(manifest.dependencies.zod);const source=await readFile(join(target,'src/index.ts'),'utf8');assert.throws(()=>createProject('fixture',root));assert.throws(()=>createProject('../escape',root),/simple project name/);assert.equal(await readFile(join(target,'src/index.ts'),'utf8'),source)}finally{await rm(root,{recursive:true,force:true})}
});
