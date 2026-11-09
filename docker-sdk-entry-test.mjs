import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const entry=fileURLToPath(new URL('./docker-sdk-entry.mjs',import.meta.url));
test('Docker SDK entry refuses missing binding before starting any runtime',()=>{
 const result=spawnSync(process.execPath,[entry,'--profile','sdk'],{env:{PATH:process.env.PATH},encoding:'utf8'});
 assert.equal(result.status,125);assert.match(result.stderr,/no validated sandbox binding/);assert.equal(result.stdout,'');
});
test('Docker SDK entry rejects host patches and cannot fall back after sandbox failure',()=>{
 const env={PATH:process.env.PATH,SCRUM_SBX_BIN:'/nonexistent/scrum-sbx',SCRUM_DOCKER_SANDBOX:'scrum-worker-11111111-1111-4111-8111-111111111111'};
 const patch=spawnSync(process.execPath,[entry,'--profile','sdk','--patch','/host/secret'],{env,encoding:'utf8'});
 assert.equal(patch.status,125);assert.match(patch.stderr,/only its preconfigured/);
 const missing=spawnSync(process.execPath,[entry,'--profile','sdk'],{env,encoding:'utf8'});
 assert.equal(missing.status,125);assert.match(missing.stderr,/could not start/);assert.equal(missing.stdout,'');
});
