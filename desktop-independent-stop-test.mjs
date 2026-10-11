import {test} from 'node:test';
import assert from 'node:assert/strict';
import {NativeDesktopStop} from './independent/desktop-native-stop.mjs';
const ready='console.log(JSON.stringify({globalLive:true,suspended:false}));';
test('native stop host fails closed on stop and unexpected process exit',async()=>{
 const events=[];const listener=new NativeDesktopStop({executable:process.execPath,args:['-e',ready+'setTimeout(()=>{console.log(JSON.stringify({globalLive:true,suspended:true,reason:"hotkey"}));},20);setTimeout(()=>process.exit(0),40)'],onStop:s=>events.push(s)});
 await listener.open();listener.assertLive();await listener.exit;assert(events.some(s=>s.reason==='hotkey'));assert(events.some(s=>s.reason==='Native stop listener exited'));assert.throws(()=>listener.assertLive(),/unavailable or suspended/);await listener.close();
});
test('native stop refuses implicit resume and malformed startup then reaps listener',async()=>{
 const listener=new NativeDesktopStop({executable:process.execPath,args:['-e',ready+'setTimeout(()=>{console.log(JSON.stringify({globalLive:true,suspended:true}));console.log(JSON.stringify({globalLive:true,suspended:false}));},20);setInterval(()=>{},1000)']});
 await listener.open();await listener.exit;assert.throws(()=>listener.assertLive(),/unavailable or suspended/);await listener.close();
 const malformed=new NativeDesktopStop({executable:process.execPath,args:['-e','console.log("invalid");setInterval(()=>{},1000)']});await assert.rejects(malformed.open(),/Invalid native stop response/);assert.equal(malformed.closed,true);
});
test('native stop closes its owned process through stdin EOF',async()=>{
 const listener=new NativeDesktopStop({executable:process.execPath,args:['-e',ready+'process.stdin.resume();process.stdin.on("end",()=>process.exit(0));setInterval(()=>{},1000)']});await listener.open();await listener.close();assert.equal(listener.child.exitCode,0);assert.throws(()=>listener.assertLive(),/unavailable/);
});
