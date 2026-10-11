import {formatGrepResult,formatCountResult} from './independent/search-format.mjs';
export function validateScrumGrep(args){
 if(args.output_mode!==undefined&&!['content','files_with_matches','count'].includes(args.output_mode))throw Error('Invalid grep output_mode');
 if(args.head_limit!==undefined&&(!Number.isSafeInteger(args.head_limit)||args.head_limit<0))throw Error('head_limit must be a nonnegative integer; 0 means unlimited');
}
export function formatScrumGrep(args,matches){
 validateScrumGrep(args);const mode=args.output_mode||'files_with_matches',limit=args.head_limit||0,files=new Map();
 for(const match of matches){const rows=files.get(match.path)||[];rows.push(match);files.set(match.path,rows);}
 let text;
 if(mode==='count'){const rows=[...files].map(([file,rows])=>({file,count:rows.length}));text=formatCountResult(limit?rows.slice(0,limit):rows);}
 else {const all=mode==='content'?matches.map(row=>({file:row.path,line:row.lineNumber,text:row.line})):[...files.keys()].map(file=>({file,line:0,text:''})),rows=limit?all.slice(0,limit):all;text=formatGrepResult({matches:rows,totalMatches:rows.length,filesSearched:new Set(rows.map(row=>row.file)).size,truncated:false});if(rows.length<all.length)text+='\n[Limited by head_limit: '+rows.length+' of '+all.length+' entries]';}
 if(Buffer.byteLength(text)>256*1024)throw Error('Grep formatted output exceeds 256KB; narrow the pattern or set head_limit. Results are not complete.');
 return text;
}
