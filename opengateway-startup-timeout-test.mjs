import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

test('a stalled optional credential file does not block startup',()=>{
 const dir=mkdtempSync(join(tmpdir(),'gateway-stall-'));
 try{
  const fifo=join(dir,'auth');execFileSync('mkfifo',[fifo]);
  const module=pathToFileURL(join(import.meta.dirname,'opengateway.mjs')).href;
  const code=`import {registerOpenGateway} from ${JSON.stringify(module)};const r=await registerOpenGateway({},{env:{},authPath:${JSON.stringify(fifo)}});if(r.registered)process.exit(2);process.exit(0)`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',code],{timeout:7000,encoding:'utf8'});
  assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stderr);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
