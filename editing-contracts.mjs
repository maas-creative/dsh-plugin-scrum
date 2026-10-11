import {computeLineHash} from './independent/hashline-edits.mjs';
export function decorateHashlineRead(content,enabled=false){
 if(!enabled)return content;
 return content.map(block=>block.type!=='text'?block:{...block,text:block.text.replace(/(^<content>\n?|\n)(\s*\d+)[:|] ?([^\n]*)/g,(all,prefix,number,text)=>text.endsWith('... (line truncated to 2000 chars)')?all:`${prefix}${Number(number)}#${computeLineHash(Number(number),text)}|${text}`)});
}
export function bashReadHint(exec){
 return exec.name.toLowerCase()==='bash'&&[/^\s*cat\s+(?!-)[^\s|&;]+\s*$/,/^\s*(?:head|tail)\s+(?:-n\s+\d+\s+)?(?!-)[^\s|&;]+\s*$/].some(pattern=>pattern.test(exec.arguments?.command||''))?'Prefer the Read tool over cat/head/tail. Read provides line numbers and hash anchors for precise editing.':null;
}
