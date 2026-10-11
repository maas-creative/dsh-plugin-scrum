import {noninteractiveSpec} from './noninteractive.mjs';
import {SandboxBashExecutor} from '@deepseek-ai/dsh-bash-sandbox';
import {memorySeatbeltFence} from './memory-sandbox.mjs';
import {memoryLocation} from './memory.mjs';
export function memoryOnlyArgv(argv,cwd){
 if(process.platform!=='darwin')throw Error('Memory process boundary requires a platform adapter');
 return ['/usr/bin/sandbox-exec','-p','(version 1) (allow default) '+memorySeatbeltFence(memoryLocation({cwd}).directory),'--',...argv];
}
// Full access widens normal filesystem policy, while memory ownership still applies.
export default class ScrumMemoryBash extends SandboxBashExecutor {
 static inject=SandboxBashExecutor.inject;
 static Config=SandboxBashExecutor.Config;
 async execute(spec){
  spec=noninteractiveSpec(spec);
  if(spec.sandboxPolicy.mode!=='danger-full-access')return super.execute(spec);
  return this.executeArgv(spec,async signal=>{signal.throwIfAborted();return memoryOnlyArgv(['bash','-c',spec.command],spec.sandboxPolicy.workspaceRoot)});
 }
}
