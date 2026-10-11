export const BTW_PARENT_CONTEXT_MAX_BYTES=65536;
export const BTW_PARENT_CONTEXT_MAX_MESSAGES=64;
const size=value=>Buffer.byteLength(JSON.stringify(value));
function project(message){return {info:{id:String(message.info?.id??''),sessionID:String(message.info?.sessionID??''),role:String(message.info?.role??'user')},parts:(message.parts||[]).filter(part=>part.type==='text'&&typeof part.text==='string').map(part=>({type:'text',text:part.text}))};}
function clip(message,budget){
 const characters=[...message.parts.map(part=>part.text).join('\n')];let low=0,high=characters.length,best;
 while(low<=high){const count=Math.floor((low+high)/2),candidate={info:message.info,parts:[{type:'text',text:characters.slice(0,count).join('')+'\n[Parent context clipped]'}]};
  if(size([candidate])<=budget){best=candidate;low=count+1;}else high=count-1;
 }
 return best;
}
export function boundBtwParentContext(messages){
 const selected=[];
 for(const source of messages.slice(-BTW_PARENT_CONTEXT_MAX_MESSAGES).reverse()){
  const message=project(source);
  if(size([message,...selected])<=BTW_PARENT_CONTEXT_MAX_BYTES){selected.unshift(message);continue;}
  // Keep the newest message even when one text block is larger than the full
  // budget. Older messages are omitted rather than cutting their ownership IDs.
  if(!selected.length){const shortened=clip(message,BTW_PARENT_CONTEXT_MAX_BYTES);if(shortened)selected.push(shortened);}
  break;
 }
 return selected;
}
