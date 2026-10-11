import {readdir,lstat} from 'node:fs/promises';
import {join,posix} from 'node:path';

// A byte-based estimate, not a provider tokenizer. Round each document upward
// so adding a small document cannot disappear from the aggregate estimate.
export async function estimateSystemTokens(directory) {
 const files=[];
 async function walk(relative) {
  const path=join(directory,relative);let entries;
  try {if(!(await lstat(path)).isDirectory())return;entries=await readdir(path,{withFileTypes:true});}
  catch(error){if(error.code==='ENOENT')return;throw error;}
  for(const entry of entries.sort((a,b)=>a.name.localeCompare(b.name))){
   const name=posix.join(relative,entry.name),stat=await lstat(join(directory,name));
   if(stat.isSymbolicLink())continue;
   if(stat.isDirectory())await walk(name);
   else if(stat.isFile()&&name.endsWith('.md'))files.push({path:name,bytes:stat.size,tokens:Math.ceil(stat.size/4)});
  }
 }
 await walk('system');
 return {totalBytes:files.reduce((n,file)=>n+file.bytes,0),totalTokens:files.reduce((n,file)=>n+file.tokens,0),files};
}

export function validateDreamTokenBudget({origin,totalTokens,targetTokens}) {
 if(!Number.isSafeInteger(totalTokens)||totalTokens<0||!Number.isSafeInteger(targetTokens)||targetTokens<0)throw Error('Invalid Dream token budget estimate');
 if(origin==='pressure'&&totalTokens>=targetTokens)return {status:'budget_not_met',totalTokens,targetTokens,detail:`The pressure dream target requires fewer than ${targetTokens} estimated tokens; the integrated memory currently estimates ${totalTokens}.`};
 return {status:'valid',totalTokens,targetTokens};
}
