import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {writeClaudeTranscript} from './claude-transcript.mjs';
test('hook transcript preserves tool correlation, refreshes history and excludes opaque provider blocks',async()=>{
 const home=await mkdtemp(join(tmpdir(),'scrum-transcript-'));let messages=[{id:'u',role:'user',content:[{type:'text',text:'request'}]},{role:'assistant',content:[{type:'tool-call',id:'call-1',name:'read',arguments:'{"file_path":"source.md"}'},{type:'reasoning',opaque:'PRIVATE_PROVIDER_DATA'}]},{role:'tool',toolCallId:'call-1',isError:false,content:[{type:'text',text:'source'}]}];
 const agent={session:{id:'../../escaped',deriveMessages:()=>messages}};
 try{const path=writeClaudeTranscript(agent,{home}),raw=await readFile(path,'utf8'),rows=raw.trim().split('\n').map(JSON.parse);assert(path.startsWith(join(home,'.claude/transcripts')+'/'));assert.equal((await stat(path)).mode&0o777,0o600);assert(!raw.includes('PRIVATE_PROVIDER_DATA'));assert.equal(rows[1].message.content[0].type,'tool_use');assert.deepEqual(rows[1].message.content[0].input,{file_path:'source.md'});assert.equal(rows[2].message.content[0].tool_use_id,'call-1');messages=[messages[0]];assert.equal(writeClaudeTranscript(agent,{home}),path);assert.equal((await readFile(path,'utf8')).trim().split('\n').length,1);}finally{await rm(home,{recursive:true,force:true});}
});
