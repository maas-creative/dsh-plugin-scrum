// Scrum's bounded argv-based tmux subprocess transport.
import{execFile}from'node:child_process';
export const TMUX_LAYOUT_VALUES=Object.freeze(['even-horizontal','even-vertical','main-horizontal','main-vertical','tiled']);
export async function runTmuxCommand(binary,args,{timeoutMs=5000,retry=0}={}){
 if(typeof binary!=='string'||!binary||!Array.isArray(args)||args.some(value=>typeof value!=='string'))throw TypeError('tmux requires a binary path and string arguments');
 if(!Number.isFinite(timeoutMs)||timeoutMs<1||timeoutMs>60000||!Number.isInteger(retry)||retry<0||retry>3)throw RangeError('Invalid tmux subprocess limits');
 let result;
 for(let attempt=0;attempt<=retry;attempt++){
  result=await new Promise(resolve=>execFile(binary,args,{encoding:'utf8',timeout:timeoutMs,killSignal:'SIGKILL',maxBuffer:4*1024*1024,windowsHide:true},(error,stdout,stderr)=>resolve({success:!error,output:stdout.trim(),stderr:stderr.trim()|| (error?'tmux subprocess failed: '+(error.code==='ERR_CHILD_PROCESS_STDIO_MAXBUFFER'?'output limit exceeded':error.killed?'timed out':error.code||'unknown'):''),exitCode:error?.code??0})));
  if(result.success)break;
 }
 return result;
}
