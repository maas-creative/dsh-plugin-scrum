import{createHash}from'node:crypto';
// New reads use an explicitly versioned SHA-256 content fingerprint. Historical
// unversioned anchors require a fresh read; they never authorize a blind write.
export function computeLineHash(_lineNumber,text){if(typeof text!=='string')throw TypeError('Line text must be a string');return 'S'+createHash('sha256').update(text).digest('hex').slice(0,12).toUpperCase();}
export function applyHashlineEdits(source,edits){
 if(typeof source!=='string'||!Array.isArray(edits))throw TypeError('Hashline editing requires source text and an edits array');
 const original=source===''?[]:source.split('\n'),jobs=[];
 function anchor(value){if(typeof value!=='string')throw TypeError('A line anchor is required');const match=/^\s*([1-9]\d*)#(S[0-9A-F]{12})(?=\s|\||$)/.exec(value);if(!match)throw Error('Unknown or legacy line anchor; reread the file using hashline_read');const line=Number(match[1]);if(!Number.isSafeInteger(line)||line>original.length)throw Error('Line anchor is outside the source; reread the file');if(computeLineHash(line,original[line-1])!==match[2])throw Error('Line anchor content is outdated; reread the file');return line-1;}
 for(let index=0;index<edits.length;index++){
  const edit=edits[index];if(!edit||!['replace','append','prepend'].includes(edit.op))throw TypeError('Invalid line edit operation');const lines=edit.lines===null?[]:typeof edit.lines==='string'?edit.lines.split('\n'):edit.lines;if(!Array.isArray(lines)||lines.some(line=>typeof line!=='string'))throw TypeError('Replacement lines must be strings');
  if(edit.op==='replace'){const start=anchor(edit.pos||edit.end),end=edit.end?anchor(edit.end):start;if(end<start)throw Error('Replacement range is reversed');jobs.push({start,end,remove:end-start+1,lines:[...lines],index,anchor:start});}
  else{if(edit.end!==undefined)throw Error('Insertions cannot declare an end anchor');const position=edit.pos?anchor(edit.pos):null;const start=position===null?(edit.op==='append'?original.length:0):position+(edit.op==='append'?1:0);jobs.push({start,end:start-1,remove:0,lines:[...lines],index,anchor:position});}
 }
 // Duplicate exact replacements intentionally use the final supplied edit.
 const replacements=new Map();for(const job of jobs.filter(job=>job.remove))replacements.set(job.start+':'+job.end,job);
 const selected=jobs.filter(job=>!job.remove||replacements.get(job.start+':'+job.end)===job);
 for(let i=0;i<selected.length;i++)for(let j=i+1;j<selected.length;j++){const first=selected[i],second=selected[j];if(first.remove&&second.remove&&first.start<=second.end&&second.start<=first.end)throw Error('Overlapping replacement ranges');const replacement=first.remove?first:second.remove?second:null,insertion=first.remove?second:first;if(replacement&&!insertion.remove&&insertion.anchor!==null&&insertion.anchor>=replacement.start&&insertion.anchor<=replacement.end)throw Error('Insertion anchor is consumed by a replacement');}
 const result=[...original];for(const job of selected.sort((first,second)=>second.start-first.start||first.index-second.index))result.splice(job.start,job.remove,...job.lines);return result.join('\n');
}
