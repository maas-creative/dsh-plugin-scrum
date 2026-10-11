// Mask quoted/control regions while retaining offsets and line breaks. This is
// a scanner over caller text, not a model instruction or a Markdown renderer.
const controlTag=name=>['hardtackle-mode','hard-tackle-mode','ultrawork-mode','omo-ultrawork-reminder'].includes(name)||(name.startsWith('omo-')&&name.endsWith('-pointer'));
export function visibleRequest(input){
 const text=String(input??'');
 // Index by UTF-16 so offsets match the original caller string, including emoji.
 const units=text.split('');const hide=(start,end)=>{for(let index=start;index<end;index++)if(units[index]!=='\n'&&units[index]!=='\r')units[index]='\0';};
 const lower=text.toLowerCase();
 for(let start=0;start<text.length;start++)if(text[start]==='<'){
  const end=text.indexOf('>',start+1);if(end<0)break;const name=lower.slice(start+1,end).trim();if(!controlTag(name))continue;const close='</'+name+'>',finish=lower.indexOf(close,end+1);hide(start,finish<0?text.length:finish+close.length);start=finish<0?text.length:finish+close.length-1;
 }
 let offset=0,fence=null;
 for(const line of text.split('\n')){
  let leading=0;while(leading<line.length&&line[leading]===' ')leading++;let content=line.slice(leading),marker=content[0],count=0;while(content[count]===marker&&(marker==='`'||marker==='~'))count++;
  if(fence){hide(offset,offset+line.length);if(leading<=3&&marker===fence.marker&&count>=fence.count&&!content.slice(count).trim())fence=null;}
  else if(leading<=3&&count>=3){hide(offset,offset+line.length);fence={marker,count};}
  else if(line.trimStart().startsWith('>'))hide(offset,offset+line.length);
  offset+=line.length+1;
 }
 for(let index=0;index<units.length;index++){
  if(units[index]!=='`')continue;const start=index;let width=1;while(units[start+width]==='`')width++;
  let close=-1;for(let cursor=start+width;cursor<units.length;cursor++){if(units[cursor]!=='`')continue;let run=1;while(units[cursor+run]==='`')run++;if(run===width){close=cursor+run;break;}cursor+=run-1;}
  if(close<0){index=start+width-1;continue;}hide(start,close);index=close-1;
 }
 return units.join('');
}
