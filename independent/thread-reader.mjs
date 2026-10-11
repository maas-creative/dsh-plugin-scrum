import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

export const THREAD_TAIL_DEFAULT_ITEMS = 60;
export const THREAD_TAIL_MAX_ITEMS = 200;
const error = (code,message,next_action='Start a new read without a cursor, or correct the requested limits.')=>({kind:'error',error:{code,message,next_action}});
const hash = input=>createHash('sha256').update(input).digest('hex');
const cursorFor = (revision,index)=>Buffer.from(JSON.stringify({version:1,revision,index})).toString('base64url');

export function readTranscript(source, options={}) {
  const mode=options.mode??'tail',budget=options.max_bytes??131072,tail=options.tail_items??THREAD_TAIL_DEFAULT_ITEMS;
  if (!['status','tail','page'].includes(mode)) return error('invalid_arguments','Read mode must be status, tail or page.');
  if (!Number.isSafeInteger(budget)||budget<1) return error('invalid_arguments','Byte budget must be a positive integer.');
  if (budget>1048576) return error('message_too_large','Requested byte budget exceeds the one-megabyte limit.');
  if (!Number.isSafeInteger(tail)||tail<1||tail>THREAD_TAIL_MAX_ITEMS) return error('invalid_arguments','Tail item count must be between 1 and 200.');
  let items,skipped=0,origin,identity;
  try {
    if (source?.kind==='live') {
      items=source.entries();origin='live_host';identity=source.id??'';
      if (!Array.isArray(items)) return error('invalid_arguments','Live transcript provider must return an array.');
    } else if (source?.kind==='file'&&typeof source.path==='string') {
      origin='session_jsonl';identity=source.path;items=[];
      for (const line of readFileSync(source.path,'utf8').split(/\r?\n/)) {
        if (!line.trim()) continue;
        try {items.push(JSON.parse(line));}catch {skipped++;}
      }
    } else return error('invalid_arguments','A live provider or transcript file is required.');
  } catch (failure) {
    return error(failure.code==='ENOENT'?'not_found':'read_failed','Transcript could not be read: '+failure.message);
  }
  let serialized;
  try {serialized=items.map(item=>JSON.stringify(item));if(serialized.some(item=>item===undefined))throw Error('Non-JSON transcript item');}
  catch {return error('read_failed','Transcript contains an unserializable item.');}
  const revision=hash(JSON.stringify([origin,identity,serialized,skipped]));
  let index=mode==='tail'?Math.max(0,items.length-tail):0;
  if (options.cursor!==undefined) {
    try {
      if(typeof options.cursor!=='string'||!options.cursor||!/^[A-Za-z0-9_-]+$/.test(options.cursor))throw Error();
      const cursor=JSON.parse(Buffer.from(options.cursor,'base64url').toString('utf8'));
      if(cursor.version!==1||typeof cursor.revision!=='string'||!Number.isSafeInteger(cursor.index)||cursor.index<0)throw Error();
      if(cursor.revision!==revision)return error('cursor_stale','Transcript changed after the previous page.');
      if(cursor.index>items.length)throw Error();
      index=cursor.index;
    }catch{return error('cursor_invalid','Cursor does not identify a valid transcript page.');}
  }
  const selected=[];let bytes=0;
  if(mode!=='status')while(index<items.length){
    const size=Buffer.byteLength(serialized[index]);
    if(bytes+size>budget){
      if(!selected.length)return error('message_too_large','The next transcript item exceeds the requested byte budget.','Increase max_bytes before reading this item; no content was silently dropped.');
      break;
    }
    selected.push(items[index++]);bytes+=size;
  }
  const truncated=mode!=='status'&&index<items.length;
  return {kind:'ok',source:origin,source_incomplete:skipped>0,mode,total_items:items.length,max_bytes:budget,skipped_lines:skipped,items:selected,truncated,next_cursor:truncated?cursorFor(revision,index):null,encoded_bytes:bytes};
}
