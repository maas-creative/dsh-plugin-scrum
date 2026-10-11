import {readFile,writeFile,rename,rm} from 'node:fs/promises';import {createRequire} from 'node:module';import {randomUUID} from 'node:crypto';
const marker='// Scrum image conversion preserves native read guards and attachment validation.';
export async function installImageCompatibility(){
 const path=createRequire(import.meta.url).resolve('@deepseek-ai/dsh-tool-fs'),original=await readFile(path,'utf8'),line='import {lookAtImageMime,convertLookAtImage} from '+JSON.stringify(new URL('./look-at-media.mjs',import.meta.url).href)+';';let source=original;
 if(source.includes(marker)){
  const pattern=/^import \{lookAtImageMime,convertLookAtImage\} from "[^\n]+";/m;if(!pattern.test(source)||!source.includes('await convertLookAtImage({data,mediaType},exec.signal)'))throw Error('Incomplete DSH image conversion adapter');source=source.replace(pattern,line);
 }else{
  const begin=source.indexOf('name: "read_image",'),end=source.indexOf('//#endregion',begin);if(begin<0||end<0)throw Error('Unsupported DSH read_image registration');let body=source.slice(begin,end);
  const replace=(before,after)=>{if(body.split(before).length!==2)throw Error('Unsupported DSH image anchor: '+before.slice(0,70));body=body.replace(before,after);};
  replace('const declared = imageMediaTypeForPath(args.file_path);','const declared = imageMediaTypeForPath(args.file_path) ?? lookAtImageMime(args.file_path);');
  replace('if (declared !== void 0) assertDeploymentAccepts(attachments, declared, args.file_path);','if (declared !== void 0) assertDeploymentAccepts(attachments, ["image/png","image/jpeg","image/webp","image/gif"].includes(declared) ? declared : "image/jpeg", args.file_path);');
  replace('const mediaType = declared ?? sniffImageMediaType(data);','const mediaType = declared ?? sniffImageMediaType(data);');
  replace('ref = await attachments.saveImage({\n\t\t\t\t\tdata,\n\t\t\t\t\tmediaType,','ref = await attachments.saveImage({\n\t\t\t\t\t...await convertLookAtImage({data,mediaType},exec.signal),');
  replace('description: "Read a PNG/JPEG/WebP/GIF file and return the image itself. Large images are downscaled automatically; do not install image libraries or create thumbnails to inspect an image.",','description: "Read an image file and return the image itself. PNG/JPEG/WebP/GIF are native; other recognized image formats are converted via sips/ImageMagick after native path authorization. Large images are downscaled automatically.",');
  source=line+'\n'+marker+'\n'+source.slice(0,begin)+body+source.slice(end);
 }
 if(source===original)return {installed:false,path};const temporary=path+'.scrum-'+randomUUID()+'.tmp';try{await writeFile(temporary,source,{flag:'wx'});await rename(temporary,path);}finally{await rm(temporary,{force:true});}return {installed:true,path};
}
