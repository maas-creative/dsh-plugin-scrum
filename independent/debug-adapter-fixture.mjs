// A synthetic adapter for transport tests. No debugger or evaluated code is run.
import {DapFrameParser} from './debug-adapter-framing.mjs';
export function runFixture(input=process.stdin,output=process.stdout){
 const parser=new DapFrameParser();let sequence=0;
 const send=message=>{const body=JSON.stringify({...message,seq:++sequence});output.write(Buffer.from(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`));};
 const event=(name,body={})=>send({type:'event',event:name,body});
 input.on('data',bytes=>{for(const request of parser.push(bytes)){
  if(request?.type!=='request')continue;
  const command=request.command,args=request.arguments||{};let body={},success=true;
  switch(command){
   case 'initialize':body={supportsConfigurationDoneRequest:true,supportsEvaluateForHovers:true};break;
   case 'launch':case 'attach':case 'configurationDone':break;
   case 'setBreakpoints':body={breakpoints:(args.breakpoints||[]).map((item,index)=>({id:index+1,verified:true,line:item.line,column:1,message:'fixture'}))};break;
   case 'threads':body={threads:[{id:1,name:'main'}]};break;
   case 'stackTrace':body={stackFrames:[{id:42,name:'main',source:{path:'/tmp/program.py'},line:12,column:3}]};break;
   case 'scopes':body={scopes:[{name:'Locals',variablesReference:7,expensive:false}]};break;
   case 'variables':body={variables:Array.from({length:250},(_,index)=>({name:'v'+(index+1),value:String(index+1),variablesReference:0}))};break;
   case 'evaluate':body={result:'42',type:'int',variablesReference:0};break;
   case 'continue':body={allThreadsContinued:true};break;
   default:success=false;
  }
  send({type:'response',request_seq:request.seq,success,command,body,...(!success?{message:'unsupported '+command}:{})});
  if(command==='initialize')event('initialized');
  if(command==='continue')event('stopped',{reason:'breakpoint',threadId:1,allThreadsStopped:true});
 }});
}
