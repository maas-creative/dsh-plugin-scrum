import {extname} from 'node:path';
const types={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',tif:'image/tiff',tiff:'image/tiff',bmp:'image/bmp',heic:'image/heic',avif:'image/avif',svg:'image/svg+xml',pdf:'application/pdf',json:'application/json',txt:'text/plain',md:'text/markdown',csv:'text/csv',html:'text/html',xml:'application/xml',js:'text/javascript',py:'text/x-python',wav:'audio/wav',mp3:'audio/mpeg',m4a:'audio/mp4',ogg:'audio/ogg',flac:'audio/flac',mp4:'video/mp4',mov:'video/quicktime',webm:'video/webm'};
export function inferMimeTypeFromFilePath(path){return types[extname(String(path)).slice(1).toLowerCase()]||'application/octet-stream';}
export function extractBase64Data(input){if(typeof input!=='string')throw Error('Base64 input must be a string');if(!input.startsWith('data:'))return input;const match=/^data:([^;,]+);base64,([\s\S]*)$/.exec(input);if(!match)throw Error('Invalid Base64 data URL');return match[2];}
export function inferMimeTypeFromBase64(input){
 if(input?.startsWith('data:')){const match=/^data:([^;,]+);base64,/.exec(input);if(!match)throw Error('Invalid Base64 data URL');return match[1].toLowerCase();}
 const b=Buffer.from(extractBase64Data(input),'base64');
 if(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';
 if(b[0]===255&&b[1]===216)return 'image/jpeg';
 if(b.subarray(0,3).toString()==='GIF')return 'image/gif';
 if(b.subarray(0,4).toString()==='RIFF'&&b.subarray(8,12).toString()==='WEBP')return 'image/webp';
 if(b.subarray(0,4).toString()==='%PDF')return 'application/pdf';
 if(['49492a00','4d4d002a'].includes(b.subarray(0,4).toString('hex')))return 'image/tiff';
 return 'application/octet-stream';
}
export function normalizeArgs(args){const out={...args};if(out.path!==undefined){if(out.file_path!==undefined&&out.path!==out.file_path)throw Error('Conflicting input paths');out.file_path=out.path;delete out.path;}if(out.file_path!==undefined&&out.file_paths!==undefined)throw Error('Use file_path or file_paths, not both');if(out.image_data!==undefined&&out.image_data_list!==undefined)throw Error('Use image_data or image_data_list, not both');if(out.file_path!==undefined)out.file_paths=[out.file_path];if(out.image_data!==undefined)out.image_data_list=[out.image_data];return out;}
export function validateArgs(args){if(typeof args.goal!=='string'||!args.goal.trim())return 'Analysis goal required';for(const key of ['file_paths','image_data_list'])if(args[key]!==undefined&&(!Array.isArray(args[key])||args[key].some(v=>typeof v!=='string'||!v.trim())))return 'Invalid '+key;if(!(args.file_paths?.length||args.image_data_list?.length))return 'Input required';if(args.file_paths?.some(path=>/^[a-z][a-z\d+.-]*:\/\//i.test(path)))return 'Remote paths are not accepted';}
