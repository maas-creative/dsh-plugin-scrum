import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,unlink,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Context} from '@deepseek-ai/cordis';
import {SandboxPolicyService} from '@deepseek-ai/dsh-sandbox-policy';
import {SessionProjectionRegistry} from '@deepseek-ai/dsh-session-projection';
import ScrumMemoryFileSystem from './memory-filesystem.mjs';
import {memoryLocation} from './memory.mjs';

test('real DSH filesystem rejects foreign memory and rechecks a swapped symlink',async()=>{
 const home=await mkdtemp(join(tmpdir(),'scrum-memory-fs-')),saved=process.env.DSH_HOME;
 try{
  process.env.DSH_HOME=home;
  const cwd=join(home,'project'),otherCwd=join(home,'other-project');
  await mkdir(cwd);await mkdir(otherCwd);
  const own=memoryLocation({cwd}).directory,foreign=memoryLocation({cwd:otherCwd}).directory;
  await mkdir(own,{recursive:true});await mkdir(foreign,{recursive:true});
  await writeFile(join(own,'note.md'),'own');await writeFile(join(foreign,'note.md'),'private');
  const ctx=new Context();new SessionProjectionRegistry(ctx);new SandboxPolicyService(ctx,{mode:'danger-full-access',workspaceRoot:cwd});
  const fs=new ScrumMemoryFileSystem(ctx,{cwd,diffBasisMaxBytes:1048576});
  const denied=error=>error.code==='SCRUM_MEMORY_ACCESS_DENIED';
  assert.equal(await fs.readText(await fs.resolve(join(own,'note.md'))),'own');
  await assert.rejects(fs.resolve(join(foreign,'note.md')),denied);
  const alias=join(cwd,'alias');await symlink(own,alias);
  const stale=await fs.resolve(join(alias,'note.md'));
  await unlink(alias);await symlink(foreign,alias);
  await assert.rejects(fs.resolve(join(alias,'note.md')),denied);
  // A previously resolved canonical target stays confined to its original identity.
  assert.equal(await fs.readText(stale),'own');
  await assert.rejects(fs.resolve(join(alias,'new.md')),denied);
  assert.equal(await readFile(join(foreign,'note.md'),'utf8'),'private');
 }finally{
  if(saved===undefined)delete process.env.DSH_HOME;else process.env.DSH_HOME=saved;
  await rm(home,{recursive:true,force:true});
 }
});
