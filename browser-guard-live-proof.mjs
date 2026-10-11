import http from 'node:http';
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import * as runtime from './skills/browser/runtime/omowright/index.js';
import {guardOmowright} from './independent/browser-guard.mjs';
const page='<!doctype html><title>Scrum guard acceptance</title><textarea id="draft">ab</textarea><button id="send" onclick="window.sent=(window.sent||0)+1">Send</button><output id="count">Local test only</output>';
const server=http.createServer((req,res)=>{res.setHeader('content-type','text/html');res.end(page)});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let session,questions=0;
const evidence={scope:'Actual connected BrowserSkill, local synthetic page, independent staged guard',startedAt:new Date().toISOString(),passed:false};
try {
 const host={callTool:async(name)=>name==='ask_user_question'?(questions++,{details:{status:'answered',answers:{q:"Don't allow"}}}):{}};
 session=await guardOmowright(runtime,{env:{OMO_BROWSER_ENGINE:'connected'},host}).connectBrowserSkill({name:'Scrum independent guard verification',focused:false});
 await session.navigate('http://127.0.0.1:'+server.address().port);
 evidence.snapshot=await session.snapshot({maxTokens:1500});
 await session.fill('#draft','ab');
 await session.focus('#draft');
 await session.press('Enter');
 evidence.afterNewline=await session.evaluate('({draft:document.querySelector("#draft").value,sent:window.sent||0})');
 const value=evidence.afterNewline?.value??evidence.afterNewline;
 assert.equal(value.draft,'ab\n');assert.equal(value.sent,0);
 await assert.rejects(session.click('#send'),error=>error.code==='user_declined');
 evidence.afterDecline=await session.evaluate('({sent:window.sent||0})');
 assert.equal((evidence.afterDecline?.value??evidence.afterDecline).sent,0);
 assert.equal(questions,1);
 await session.stop();
 await assert.rejects(session.snapshot(),error=>error.code==='user_stopped');
 evidence.confirmations=questions;evidence.passed=true;
} catch(error){evidence.error={name:error.name,code:error.code,message:error.message};process.exitCode=1}
finally {try{await session?.stop()}catch{};await new Promise(resolve=>server.close(resolve));writeFileSync('work/independent-browser/guard-live-proof.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify({passed:evidence.passed,error:evidence.error,afterNewline:evidence.afterNewline,confirmations:questions}))}
