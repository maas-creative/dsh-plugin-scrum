import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {join} from 'node:path';
import test from 'node:test';import assert from 'node:assert/strict';import {readdir,mkdtemp,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {decodeLookAtMedia,prepareLookAtImage,extractLookAtDocument,explicitSpeechGoal} from './look-at-media.mjs';
const tiff='SUkqACQAAAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAD/AAAADwAAAQMAAQAAAAMAAAABAQMAAQAAAAMAAAACAQMAAwAAAO4AAAADAQMAAQAAAAEAAAAGAQMAAQAAAAIAAAARAQQAAQAAAAgAAAASAQMAAQAAAAEAAAAVAQMAAQAAAAMAAAAWAQMAAQAAAAABAAAXAQQAAQAAABsAAAAaAQUAAQAAAN4AAAAbAQUAAQAAAOYAAAAcAQMAAQAAAAEAAAAoAQMAAQAAAAIAAABTAQMAAwAAAPQAAAAAAAAAMzPLAAAACAAzM8sAAAAIAAgACAAIAAEAAQABAA==';
test('look_at converts supplied TIFF bytes through real platform converter and removes private files',async()=>{
 const before=(await readdir(tmpdir())).filter(name=>name.startsWith('scrum-look-at-')).sort();
 const image=await prepareLookAtImage('data:image/tiff;base64,'+tiff,new AbortController().signal);assert.equal(image.mediaType,'image/jpeg');assert.equal(image.data.subarray(0,3).toString('hex'),'ffd8ff');
 assert.deepEqual((await readdir(tmpdir())).filter(name=>name.startsWith('scrum-look-at-')).sort(),before);
});
test('look_at rejects canceled conversion and non-image media and cleans converter failures',async()=>{
 assert.equal(decodeLookAtMedia('data:image/tiff;base64,'+tiff).mediaType,'image/tiff');
 await assert.rejects(prepareLookAtImage('data:image/tiff;base64,'+tiff,AbortSignal.abort()),{name:'AbortError'});
 await assert.rejects(prepareLookAtImage('data:application/pdf;base64,JVBERg=='),/conversion adapter/);
 const before=(await readdir(tmpdir())).filter(name=>name.startsWith('scrum-look-at-')).sort();await assert.rejects(prepareLookAtImage('data:image/tiff;base64,QUJD',new AbortController().signal),/Unable to convert/);
 assert.deepEqual((await readdir(tmpdir())).filter(name=>name.startsWith('scrum-look-at-')).sort(),before);
});

test('complete document extraction preserves UTF-8 formats and refuses binary, clipping and native unsupported media',async()=>{
 for(const mediaType of ['application/json','text/csv','text/md','text/html','application/xml','text/javascript','text/x-python','application/octet-stream'])assert.equal((await extractLookAtDocument({data:Buffer.from('complete Ω source'),mediaType})).text,'complete Ω source');
 await assert.rejects(extractLookAtDocument({data:Buffer.alloc(512*1024+1,65),mediaType:'text/plain'}),/refusing truncated/);
 await assert.rejects(extractLookAtDocument({data:Buffer.from([0xff]),mediaType:'application/octet-stream'}),/not UTF-8/);
 await assert.rejects(extractLookAtDocument({data:Buffer.from([0]),mediaType:'application/octet-stream'}),/binary/);
 for(const mediaType of ['audio/wav','video/mp4'])await assert.rejects(extractLookAtDocument({data:Buffer.from('fixture'),mediaType}));
});

test('real video adapter preserves every frame, rejects long clips, and reports missing audio backend without sampling',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'look-at-fixture-'));
 try{
  const command=promisify(execFile),source=join(directory,'clip.mp4');
  await command('ffmpeg',['-v','error','-f','lavfi','-i','color=c=yellow:s=160x120:r=2:d=1','-an',source]);
  const result=await extractLookAtDocument({data:await readFile(source),mediaType:'video/mp4'});assert.equal(result.images.length,2);assert.match(result.text,/All 2 decoded video frames/);
  const long=join(directory,'long.mp4');await command('ffmpeg',['-v','error','-f','lavfi','-i','color=c=yellow:s=160x120:r=25:d=1','-an',long]);await assert.rejects(extractLookAtDocument({data:await readFile(long),mediaType:'video/mp4'}),/refusing sampled/);
  {const audio=join(directory,'sound.wav');await command('ffmpeg',['-v','error','-f','lavfi','-i','sine=frequency=440:duration=1',audio]);const bytes=await readFile(audio);await assert.rejects(extractLookAtDocument({data:bytes,mediaType:'audio/wav'},undefined,{goal:'Analyze this sound'}),/Generic acoustic analysis.*Original bytes preserved/);if(!process.env.SCRUM_LOOK_AT_WHISPER_MODEL)await assert.rejects(extractLookAtDocument({data:bytes,mediaType:'audio/wav'},undefined,{goal:'Transcribe the speech'}),/no model is configured/);}
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('speech-only routing never treats non-speech or nonverbal acoustic requests as transcription',()=>{for(const goal of ['Describe non-speech sounds','Analyze non speech sounds','Summarize nonverbal speech cues','Describe non-verbal speech','Analyze non-spoken speech','Describe non‑speech sounds','非発話の音を解析','発話と非言語の音を説明'])assert.equal(explicitSpeechGoal(goal),false,goal);for(const goal of ['Transcribe the speech','Summarize the spoken message','文字起こしをして'])assert.equal(explicitSpeechGoal(goal),true,goal);});
