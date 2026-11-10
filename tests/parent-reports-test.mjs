import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {ParentReports} from "../parent-reports.mjs";
function store(){const m=new Map();return {setting:(k,d)=>m.has(k)?structuredClone(m.get(k)):d,set:(k,v)=>m.set(k,structuredClone(v)),all:()=>[...m.entries()].filter(([k])=>k.startsWith('scrumReport:')).map(([,v])=>({value:JSON.stringify(v)}))}}
const assignment=(id,parentSession='parent',status='review')=>({id,parentSession,taskId:id,taskVersion:2,status,result:'作成済み',artifact:{path:'/report',hash:'hash'}});
test('途中完了は通知のみ、最後の担当終了で親を再開、重複と親違いを保護',async()=>{
 const s=store(),sent=[];let running=[{parentSession:'parent',status:'running'}];const r=new ParentReports(s,{list:()=>running,deliver:async(p,b)=>sent.push([p,b]),debounceMs:0});
 r.enqueue(assignment('a'));r.enqueue(assignment('a'));await r.flush();assert.equal(sent.length,1);assert.equal(sent[0][1].wake,false);assert.equal(sent[0][1].reports[0].verified,false);
 running=[];r.enqueue(assignment('b'));r.enqueue(assignment('c','other'));await r.flush();assert.equal(sent.length,3);assert.equal(sent[1][0],'parent');assert.equal(sent[1][1].wake,true);assert.equal(sent[2][0],'other');await r.flush();assert.equal(sent.length,3);
});
test('親が忙しい間は保存して待機し、同時完了をまとめて一回再開',async()=>{
 const s=store(),sent=[];let busy=true;const r=new ParentReports(s,{list:()=>[],isBusy:()=>busy,deliver:async(p,b)=>sent.push(b),debounceMs:0});r.enqueue(assignment('a'));r.enqueue(assignment('b'));await r.flush();assert.equal(sent.length,0);assert.equal(r.all().length,2);
 busy=false;await Promise.all([r.flush(),r.flush()]);assert.equal(sent.length,1);assert.equal(sent[0].reports.length,2);assert.equal(sent[0].wake,true);
});
test('失敗は他の担当が実行中でも親を再開し、通知失敗と再起動でも同じ配送IDを再送',async()=>{
 const s=store(),ids=[];let now=0;const deps={list:()=>[{parentSession:'parent',status:'running'}],now:()=>now,debounceMs:0,deliver:async(p,b)=>{ids.push(b.id);assert.equal(b.wake,true);throw Error('接続失敗')}};
 const r=new ParentReports(s,deps);r.enqueue(assignment('a','parent','error'));await r.flush();assert.equal(r.all()[0].state,'pending');assert.equal(r.all()[0].attempts,1);
 const resumed=new ParentReports(s,{...deps,deliver:async(p,b)=>ids.push(b.id)});resumed.enqueue(assignment('b'));now=3000;await resumed.flush();assert.equal(ids[0],ids[1]);assert.equal(resumed.all().find(r=>r.assignmentId==='a').state,'delivered');assert.equal(resumed.all().find(r=>r.assignmentId==='b').state,'pending');await resumed.flush();assert.equal(ids.length,3);
});

// The legacy settings path is used by stores that expose only setting/set/all.
// This regression runs it against a real SQLite file so restart recovery and
// retained history are proven on durable storage, not a Map stub.
function legacyStore(path){
 const db=new DatabaseSync(path);
 db.exec("CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL)");
 return {
  setting:(k,d)=>{const r=db.prepare('SELECT value FROM settings WHERE key=?').get(k);return r?JSON.parse(r.value):d},
  set:(k,v)=>db.prepare('INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k,JSON.stringify(v)),
  all:(sql,...args)=>db.prepare(sql).all(...args),
  close:()=>db.close(),
 };
}
test('legacy settings path keeps delivery state in real SQLite across restart',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-legacy-')),path=join(dir,'ledger.sqlite');
 let s=legacyStore(path),ids=[],now=0;
 const deps={list:()=>[{parentSession:'parent',status:'running'}],now:()=>now,debounceMs:0,deliver:async(p,b)=>{ids.push(b.id);assert.equal(b.wake,true);throw Error('接続失敗')}};
 const r=new ParentReports(s,deps);
 r.enqueue(assignment('a','parent','error'));
 await r.flush();
 assert.equal(r.all().length,1);
 assert.equal(r.all()[0].state,'pending');assert.equal(r.all()[0].attempts,1);assert.equal(r.all()[0].lastError,'接続失敗');
 s.close();
 s=legacyStore(path);
 const resumed=new ParentReports(s,{...deps,deliver:async(p,b)=>ids.push(b.id)});
 assert.equal(resumed.all().length,1,'undelivered legacy report survives restart');
 now=3000;
 await resumed.flush();
 assert.equal(ids[0],ids[1],'restart reuses the same delivery id');
 assert.equal(resumed.all()[0].state,'delivered');assert.equal(resumed.all()[0].wake,true);
 assert.equal(resumed.all().length,1,'history is retained, not overwritten');
 s.close();await rm(dir,{recursive:true,force:true});
});
