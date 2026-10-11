import {SandboxedFileSystem} from '@deepseek-ai/dsh-fs-sandbox';import {AsyncLocalStorage} from 'node:async_hooks';import {memoryLocation} from './memory.mjs';import {registerMemoryFilesystemPolicy} from './independent/memory-filesystem-policy.mjs';
export default class ScrumMemoryFileSystem extends SandboxedFileSystem {
 static inject=SandboxedFileSystem.inject;static Config=SandboxedFileSystem.Config;
 contexts=new WeakMap();scope=new AsyncLocalStorage();policies=new Map();
 policy(cwd){const location=memoryLocation({cwd});if(!this.policies.has(location.directory)){let policy;registerMemoryFilesystemPolicy({registerFilesystemPolicy:value=>policy=value},{identity:location.scope,identityPaths:{root:location.directory},durableRoot:location.directory});this.policies.set(location.directory,policy)}return this.policies.get(location.directory)}
 async resolve(path,opts={}){const cwd=opts.cwd||this.scope.getStore()||this.config.cwd,target=await super.resolve(path,{...opts,cwd}),decision=this.policy(cwd).check({operation:'read',canonicalPath:super.processPath(target),toolName:'fs.resolve'});if(!decision.allow)throw Object.assign(Error(decision.reason),{code:'SCRUM_MEMORY_ACCESS_DENIED'});this.contexts.set(target,cwd);return target}
 async checked(target,operation,signal,cwd=this.contexts.get(target)||this.scope.getStore()||this.config.cwd){const fresh=await super.resolve(super.processPath(target),{cwd,signal}),decision=this.policy(cwd).check({operation,canonicalPath:super.processPath(fresh),toolName:'fs.'+operation});if(!decision.allow)throw Object.assign(Error(decision.reason),{code:'SCRUM_MEMORY_ACCESS_DENIED'});this.contexts.set(fresh,cwd);return fresh}
 async access(target,operation,signal,run,cwd=this.contexts.get(target)||this.scope.getStore()||this.config.cwd){return this.scope.run(cwd,async()=>run(await this.checked(target,operation,signal,cwd)))}
 async watch(target,changed,signal){return this.access(target,'read',signal,fresh=>super.watch(fresh,changed,signal))}
 async stat(target,signal){return this.access(target,'read',signal,fresh=>super.stat(fresh,signal))}
 async readText(target,signal){return this.access(target,'read',signal,fresh=>super.readText(fresh,signal))}
 async streamText(target,signal){return this.access(target,'read',signal,fresh=>super.streamText(fresh,signal))}
 async readBytes(target,signal,maxBytes){return this.access(target,'read',signal,fresh=>super.readBytes(fresh,signal,maxBytes))}
 async readByteRange(target,range,signal){return this.access(target,'read',signal,fresh=>super.readByteRange(fresh,range,signal))}
 async listDir(target,signal){return this.access(target,'enumerate',signal,fresh=>super.listDir(fresh,signal))}
 async lstat(path,opts={},signal){await this.resolve(path,{...opts,signal});return super.lstat(path,opts,signal)}
 async writeText(target,content,expected,signal,policy){const cwd=policy?.workspaceRoot||this.contexts.get(target)||this.config.cwd;return this.scope.run(cwd,async()=>super.writeText(await this.checked(target,'write',signal,cwd),content,expected,signal,policy))}
 async editText(target,edit,expected,signal,policy){const cwd=policy?.workspaceRoot||this.contexts.get(target)||this.config.cwd;return this.scope.run(cwd,async()=>super.editText(await this.checked(target,'write',signal,cwd),edit,expected,signal,policy))}
}
