// LSP ranges use UTF-16 positions. The host remains responsible for guarded writes.
export function normalizeTextEdits(source,edits,lineBase=0){
 if(typeof source!=='string'||!Array.isArray(edits))throw Error('Invalid LSP text edits');
 const starts=[0];for(let i=0;i<source.length;i++)if(source[i]==='\n')starts.push(i+1);
 const offset=position=>{
  const line=position?.line-lineBase,column=position?.character;
  if(!Number.isInteger(line)||line<0||line>=starts.length||!Number.isInteger(column)||column<0)throw Error('LSP position outside document');
  let end=line+1<starts.length?starts[line+1]-1:source.length;if(end>starts[line]&&source[end-1]==='\r')end--;
  if(starts[line]+column>end)throw Error('LSP position outside line');
  const index=starts[line]+column;if(index>starts[line]&&index<end&&/[\uD800-\uDBFF]/.test(source[index-1])&&/[\uDC00-\uDFFF]/.test(source[index]))throw Error('LSP position splits a surrogate pair');
  return index;
 };
 const ranges=edits.map((edit,index)=>{if(typeof edit?.newText!=='string')throw Error('LSP edit text required');const start=offset(edit.range?.start),end=offset(edit.range?.end);if(end<start)throw Error('Reversed LSP edit');return {start,end,text:edit.newText,index};}).sort((a,b)=>a.start-b.start||a.end-b.end||a.index-b.index);
 for(let i=1;i<ranges.length;i++){const a=ranges[i-1],b=ranges[i];if(b.start<a.end||b.start===a.start&&(a.end>a.start||b.end>b.start))throw Error('Overlapping LSP edits');}
 let text=source;for(const edit of ranges.slice().reverse())text=text.slice(0,edit.start)+edit.text+text.slice(edit.end);
 return {text,edits:ranges};
}
