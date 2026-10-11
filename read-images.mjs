import {calculateTargetDimensions} from './independent/image-size.mjs';
// Only Anthropic Read images need the upstream long-edge hook; other provider routes stay intact.
export async function resizeReadImages(ctx,exec,result){
 if(result.isError||!['read','read_image'].includes(exec.name)||exec.agent?.options.provider!=='anthropic')return null;
 const attachments=ctx.get('attachments');if(!attachments)return null;const content=[],info=[];
 for(const block of result.content||[]){if(block.type!=='image'){content.push(block);continue}const ref=block.attachment,target=calculateTargetDimensions(ref.width,ref.height),name=ref.name||'image';
  if(!target){content.push(block);info.push(`${name}: ${ref.width}x${ref.height} (within limits)`);continue}
  try{const image=await attachments.readImageRequest(ref,{...target,maxBytes:5*1024*1024},exec.signal);if(image.bytes>5*1024*1024||Math.max(image.width,image.height)>1568){info.push(`${name}: exceeds provider limits, image removed to prevent API error`);continue}const resized=await attachments.saveImage({data:image.data,mediaType:image.mediaType,name:ref.name});content.push({...block,attachment:resized});info.push(`${name}: ${ref.width}x${ref.height} -> ${resized.width}x${resized.height} (resized)`)}catch(error){exec.signal?.throwIfAborted();content.push(block);info.push(`${name}: resize failed (${error.message})`)}
 }
 if(!info.length)return null;content.push({type:'text',text:'[Image Info]\n'+info.map(line=>'- '+line).join('\n')});return content;
}
