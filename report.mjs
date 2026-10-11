import {realpath,mkdir,open,lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import {resolve,relative,dirname,join,sep} from 'node:path';
export async function writeReport(cwd,path,content){
 if(typeof content!=='string'||!content.trim()||Buffer.byteLength(content)>200000)throw Error('報告書は空でない200KB以下の文字列で指定してください');
 const source=resolve(cwd),root=await realpath(cwd),requested=resolve(path);
 const target=requested.startsWith(source+sep)?resolve(root,relative(source,requested)):requested;
 if(!target.startsWith(root+sep))throw Error('報告書は担当の作業フォルダ内に保存してください');
 let parent=root;
 for(const part of relative(root,dirname(target)).split(sep).filter(Boolean)){
  const next=join(parent,part);try{await mkdir(next,{mode:0o700})}catch(error){if(error.code!=='EEXIST')throw error}
  parent=await realpath(next);if(parent!==root&&!parent.startsWith(root+sep))throw Error('報告書の保存先が作業フォルダ外です');
 }
 const actual=join(parent,relative(dirname(target),target));
 try{const info=await lstat(actual);if(!info.isFile()||info.nlink!==1)throw Error('報告書の保存先は通常ファイルにしてください')}catch(error){if(error.code!=='ENOENT')throw error}
 const file=await open(actual,constants.O_WRONLY|constants.O_CREAT|constants.O_TRUNC|constants.O_NOFOLLOW,0o600);
 try{await file.writeFile(content);await file.sync()}finally{await file.close()}
 return actual;
}
