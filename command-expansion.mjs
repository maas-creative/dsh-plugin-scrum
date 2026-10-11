import {dirname,resolve,relative,isAbsolute} from 'node:path';
import {realpath,stat} from 'node:fs/promises';
export const commandVariables=(template,input='')=>template.replace(/\$\{user_message\}|\$ARGUMENTS/g,()=>input);
export const hasCommandReferences=template=>/@[^\s@]+|!`[^`]+`/.test(template);
export async function expandCommandTemplate(command,input,{read,execute,maxBytes=1024*1024}={}){
 const root=await realpath(dirname(command.path));let text=command.template;
 for(let depth=0;depth<3;depth++){
  const refs=[...text.matchAll(/@([^\s@]+)/g)],replacements=new Map();
  for(const [token,path] of refs){
   if(replacements.has(token))continue;
   const expanded=path.replace(/\$\{(\w+)\}|\$(\w+)/g,(match,a,b)=>process.env[a||b]??match),target=resolve(root,expanded),inside=relative(root,target);
   if(inside==='..'||inside.startsWith('../')||isAbsolute(inside)){replacements.set(token,'[path rejected: '+path+']');continue;}
   let real;try{real=await realpath(target)}catch(error){if(error.code==='ENOENT')continue;throw error}
   const rel=relative(root,real);if(rel==='..'||rel.startsWith('../')||isAbsolute(rel)){replacements.set(token,'[path rejected: '+path+']');continue;}
   const info=await stat(real);if(!info.isFile()){replacements.set(token,'[cannot read directory: '+real+']');continue;}
   if(info.size>maxBytes)throw Error('Referenced command file exceeds size limit');
   if(!read)throw Error('Native file reader unavailable');replacements.set(token,await read(real));
  }
  for(const [token,value]of replacements)text=text.split(token).join(value);
  const embedded=[...text.matchAll(/!`([^`]+)`/g)],outputs=new Map();
  for(const [token,shell]of embedded){if(outputs.has(token))continue;if(!execute)throw Error('Native command executor unavailable');try{outputs.set(token,await execute(shell))}catch(error){outputs.set(token,'[error: '+error.message+']')}}
  for(const [token,value]of outputs)text=text.split(token).join(value);
  if(Buffer.byteLength(text)>maxBytes)throw Error('Expanded command exceeds size limit');
  if(!replacements.size&&!outputs.size)break;
 }
 // User arguments are inserted after expansion; their contents cannot execute commands.
 return commandVariables(text,input);
}
