export class ScrumEvents{
 constructor(store){this.s=store;store.db.exec('CREATE TABLE IF NOT EXISTS scrum_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,parent TEXT NOT NULL,type TEXT NOT NULL,body TEXT NOT NULL,created INTEGER NOT NULL)')}
 append(parent,type,body){const r=this.s.run('INSERT INTO scrum_events(parent,type,body,created) VALUES(?,?,?,?)',parent,type,JSON.stringify(body),Date.now());return Number(r.lastInsertRowid)}
 history(parent,after=0){if(!Number.isSafeInteger(after)||after<0)throw Error('イベント位置が不正です');return this.s.all('SELECT * FROM scrum_events WHERE parent=? AND seq>? ORDER BY seq',parent,after).map(e=>({schemaVersion:1,seq:e.seq,type:e.type,at:e.created,...JSON.parse(e.body)}))}
}
export async function monitorTick(runtime){
 for(const row of runtime.s.all("SELECT key,value FROM settings WHERE key LIKE 'scrumMonitor:%'")){
  const m=JSON.parse(row.value);if(!m.active)continue;const task=runtime.s.snapshot().tasks.find(t=>t.id===m.taskId);
  if(!task){runtime.s.set(row.key,{...m,active:false,error:'対象タスクがありません'});continue}
  let observation;try{const artifact=await runtime.artifact(task);observation={hash:artifact.hash,path:artifact.path,status:task.status}}catch(error){observation={status:task.status,error:error.message}}
  const signature=JSON.stringify(observation);if(m.signature===signature)continue;
  runtime.s.set(row.key,{...m,signature,observation,updated:Date.now()});runtime.events.append(m.parentSession,'monitor.changed',{monitorId:m.id,taskId:m.taskId,observation});
  if(m.signature!==undefined){runtime.reports.enqueue({id:m.id,parentSession:m.parentSession,taskId:m.taskId,taskVersion:signature,status:'review',result:'監視対象が変化しました。成果物確認前の観測です。',artifact:observation.hash?observation:null,error:observation.error});}
 }
}
