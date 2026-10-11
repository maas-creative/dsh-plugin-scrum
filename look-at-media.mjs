import {execFile} from 'node:child_process';
import {createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdtemp,writeFile,readFile,rm,stat,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {inferMimeTypeFromBase64,inferMimeTypeFromFilePath,extractBase64Data} from './independent/media-input.mjs';
const executeFile=promisify(execFile);
const nativeImages=new Set(['image/png','image/jpeg','image/webp','image/gif']);
export function decodeLookAtMedia(raw){
 const mediaType=inferMimeTypeFromBase64(raw),base64=extractBase64Data(raw);
 if(base64.length>32*1024*1024||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64))throw Error('Invalid or oversized canonical Base64 image');
 const data=Buffer.from(base64,'base64');if(!data.length||data.toString('base64')!==base64)throw Error('Invalid Base64 image');return {data,mediaType};
}
// Same conversion route as upstream look-at/image-converter.ts, but asynchronous
// and limited to supplied bytes. Never hand an unchecked user path to a process.
export async function prepareLookAtImage(raw,signal){
 return convertLookAtImage(decodeLookAtMedia(raw),signal);
}
export function lookAtImageMime(path){const mime=inferMimeTypeFromFilePath(path);return mime.startsWith('image/')?mime:undefined;}
export async function convertLookAtImage(input,signal){
 if(nativeImages.has(input.mediaType))return input;
 if(!input.mediaType.startsWith('image/'))throw Error('This input requires a media conversion adapter: '+input.mediaType);
 signal?.throwIfAborted();const directory=await mkdtemp(join(tmpdir(),'scrum-look-at-'));
 try{
  const source=join(directory,'input'),output=join(directory,'converted.jpg');
  await writeFile(source,input.data,{mode:0o600,signal});
  const attempts=process.platform==='darwin'?[['/usr/bin/sips',['-s','format','jpeg',source,'--out',output]],['convert',['--',source,output]]]:[['magick',['--',source,output]]];
  const errors=[];
  for(const [command,args]of attempts){
   signal?.throwIfAborted();try{
    await executeFile(command,args,{signal,timeout:30000,maxBuffer:256*1024});
    const info=await stat(output);if(info.size>24*1024*1024)throw Error('Converted image exceeds attachment byte budget');
    const data=await readFile(output,{signal});if(data[0]!==0xff||data[1]!==0xd8||data[2]!==0xff)throw Error('Converter did not produce JPEG');return {data,mediaType:'image/jpeg'};
   }catch(error){signal?.throwIfAborted();errors.push(error);await rm(output,{force:true});}
  }
  throw new AggregateError(errors,'Unable to convert '+input.mediaType+' with sips/ImageMagick');
 }finally{await rm(directory,{recursive:true,force:true});}
}

export const LOOK_AT_TEXT_BYTES=512*1024;
// Full content only: never treat a preview as a complete source.
export async function extractLookAtDocument({data,mediaType},signal,options={}){
 signal?.throwIfAborted();
 if(data.length>24*1024*1024)throw Error('Input exceeds the 24 MiB media byte budget');
 if(mediaType==='application/pdf'){
  const directory=await mkdtemp(join(tmpdir(),'scrum-look-at-'));
  try{
   const source=join(directory,'input.pdf');await writeFile(source,data,{mode:0o600,signal});
   const {stdout}=await executeFile('pdfinfo',[source],{signal,timeout:15000,maxBuffer:256*1024});
   const pages=Number(stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
   if(!Number.isSafeInteger(pages)||pages<1||pages>12)throw Error('Complete PDF analysis requires 1–12 pages; refusing incomplete/truncated PDF');
   await executeFile('pdftoppm',['-jpeg','-scale-to','1800',source,join(directory,'page')],{signal,timeout:45000,maxBuffer:256*1024});
   const names=(await readdir(directory)).filter(name=>/^page-\d+\.jpg$/.test(name)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));
   if(names.length!==pages)throw Error('PDF renderer omitted pages; refusing incomplete PDF');
   const images=[];let bytes=0;for(const name of names){const info=await stat(join(directory,name));bytes+=info.size;if(bytes>24*1024*1024)throw Error('Rendered PDF exceeds analysis byte budget');images.push({data:await readFile(join(directory,name),{signal}),mediaType:'image/jpeg'});}
   return {text:'Complete PDF: all '+pages+' pages rendered at a maximum 1800-pixel side. Fine print may be uncertain at this resolution.',images};
  }finally{await rm(directory,{recursive:true,force:true});}
 }
 if(mediaType.startsWith('audio/')||mediaType.startsWith('video/'))return extractLookAtAV({data,mediaType},signal,options);
 if(data.length>LOOK_AT_TEXT_BYTES)throw Error('Complete text exceeds the 512 KiB analysis byte budget; refusing truncated input');
 let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(data)}catch{throw Error('General file is not UTF-8 text and has no complete native media adapter: '+mediaType)}
 if(text.includes('\0'))throw Error('General file contains binary data and has no complete native media adapter: '+mediaType);
 return {text,images:[]};
}

// Native models have no audio/video block. Decode every video frame, never sample.
async function extractLookAtAV({data,mediaType},signal,options){
 const directory=await mkdtemp(join(tmpdir(),'scrum-look-at-'));
 try{
  const source=join(directory,'input');await writeFile(source,data,{mode:0o600,signal});
  const {stdout}=await executeFile('ffprobe',['-v','error','-count_frames','-show_streams','-show_format','-of','json',source],{signal,timeout:15000,maxBuffer:256*1024});
  const info=JSON.parse(stdout),audio=info.streams.filter(stream=>stream.codec_type==='audio'),video=info.streams.filter(stream=>stream.codec_type==='video');
  if(audio.length>1||video.length>1)throw Error('Complete audio/video adapter requires at most one audio and one video stream; refusing omitted streams');
  const duration=Number(info.format?.duration);if(!Number.isFinite(duration)||duration<=0||duration>120)throw Error('Complete media analysis requires a known duration within 120 seconds; refusing truncated input');
  let text='Complete media duration: '+duration+' seconds. ';const images=[];
  if(audio.length){
   const sha256=createHash('sha256').update(data).digest('hex');
   if(!explicitSpeechGoal(options.goal))throw Error('Audio capability unavailable: the fixed GPT 6.1 Sol route and native DSH adapter accept text/images, and raw files are projected to handles rather than audio. Generic acoustic analysis cannot be substituted with speech transcription. Original bytes preserved: '+JSON.stringify({sha256,bytes:data.length,...options.receipt})+'. Request an explicitly speech-only goal to use the configured transcription adapter.');
   const model=process.env.SCRUM_LOOK_AT_WHISPER_MODEL;
   if(!model)throw Error('Native audio input is projected to file-handle text by DSH. Complete transcription adapter requires a preinstalled whisper-cli and administrator-configured SCRUM_LOOK_AT_WHISPER_MODEL; no model is configured. No download or sampled substitute was performed.');
   const wave=join(directory,'audio.wav'),transcript=join(directory,'transcript');
   await executeFile('ffmpeg',['-v','error','-i',source,'-vn','-ar','16000','-ac','1',wave],{signal,timeout:30000,maxBuffer:256*1024});
   await executeFile(process.env.SCRUM_LOOK_AT_WHISPER_CLI||'whisper-cli',['-m',model,'-f',wave,'-otxt','-of',transcript],{signal,timeout:60000,maxBuffer:512*1024});
   const size=(await stat(transcript+'.txt')).size;if(size>LOOK_AT_TEXT_BYTES)throw Error('Complete transcript exceeds analysis budget; refusing truncated input');
   text+='Complete audio transcription (speech text only; does not preserve music, speaker identity, or other acoustic details):\n'+await readFile(transcript+'.txt',{encoding:'utf8',signal});
  }
  if(video.length){
   const frames=Number(video[0].nb_read_frames);if(!Number.isSafeInteger(frames)||frames<1||frames>24)throw Error('Complete video analysis requires 1–24 decoded frames; refusing sampled/truncated video');
   await executeFile('ffmpeg',['-v','error','-i',source,'-an','-fps_mode','passthrough','-vf','scale=1200:1200:force_original_aspect_ratio=decrease',join(directory,'frame-%04d.jpg')],{signal,timeout:30000,maxBuffer:256*1024});
   const names=(await readdir(directory)).filter(name=>/^frame-\d+\.jpg$/.test(name)).sort();if(names.length!==frames)throw Error('Video decoder omitted frames; refusing incomplete video');
   let bytes=0;for(const name of names){bytes+=(await stat(join(directory,name))).size;if(bytes>24*1024*1024)throw Error('Full decoded video exceeds analysis budget');images.push({data:await readFile(join(directory,name),{signal}),mediaType:'image/jpeg'});}
   const timeline=await executeFile('ffprobe',['-v','error','-select_streams','v:0','-show_entries','frame=best_effort_timestamp_time','-of','json',source],{signal,timeout:15000,maxBuffer:256*1024});
   const timestamps=JSON.parse(timeline.stdout).frames?.map(frame=>frame.best_effort_timestamp_time);if(timestamps?.length!==frames||timestamps.some(time=>!Number.isFinite(Number(time))))throw Error('Complete video timestamps unavailable; refusing incomplete temporal analysis');
   text+=' All '+frames+' decoded video frames are attached in playback order, resized to a maximum 1200-pixel side. Frame timestamps in seconds: '+timestamps.map((time,index)=>(index+1)+': '+time).join(', ')+'.';
  }
  if(!images.length&&!audio.length)throw Error('Media has no decodable audio/video streams');
  return {text,images};
 }finally{await rm(directory,{recursive:true,force:true});}
}

// A speech-only representation is selected only by an explicit speech request.
export function explicitSpeechGoal(goal){return typeof goal==='string'&&/\b(transcrib(?:e|ing|ed)|transcription|spoken|speech|words? said)\b|文字起こし|発話|話された/.test(goal.toLowerCase())&&!/\b(non[-\s\u2010-\u2015]*(?:speech|verbal|spoken)|music|acoustic|pitch|timbre|speaker identity|sound effects?)\b|音楽|音色|話者識別|非発話|非言語/.test(goal.toLowerCase());}
