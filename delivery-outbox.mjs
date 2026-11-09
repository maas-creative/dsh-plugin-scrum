import {randomUUID} from 'node:crypto';

const backoff=attempts=>Math.min(60000,1000*2**Math.min(attempts,6));

// Durable notification outbox. Delivery state is stored separately from the
// execution result, so retrying a notification never re-runs the worker.
export class DeliveryOutbox{
 constructor(store){this.store=store}

 enqueue({parentSession,kind='report',dedupeKey,payload,nextAt}){
  const existing=this.store.get('SELECT * FROM delivery_outbox WHERE parentSession=? AND dedupeKey=?',parentSession,dedupeKey);
  if(existing)return this.decode(existing);
  const now=Date.now(),deliveryId=randomUUID();
  this.store.run('INSERT INTO delivery_outbox(deliveryId,parentSession,kind,dedupeKey,payload,state,attempts,nextAt,leaseUntil,batchId,wake,createdAt,updatedAt,deliveredAt,lastError) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',deliveryId,parentSession,kind,dedupeKey,JSON.stringify(payload),'pending',0,nextAt,null,null,0,now,now,null,null);
  return this.decode(this.store.get('SELECT * FROM delivery_outbox WHERE deliveryId=?',deliveryId));
 }

 decode(row){return row?{...row,payload:JSON.parse(row.payload)}:null}
 all(){return this.store.all('SELECT * FROM delivery_outbox ORDER BY createdAt').map(row=>this.decode(row))}
 due(now){return this.store.all("SELECT * FROM delivery_outbox WHERE state='pending' AND nextAt<=? ORDER BY createdAt",now).map(row=>this.decode(row))}
 byIds(ids){if(!ids.length)return [];return this.store.all('SELECT * FROM delivery_outbox WHERE deliveryId IN ('+ids.map(()=>'?').join(',')+') ORDER BY createdAt',...ids).map(row=>this.decode(row))}

 // A crash between claim and delivery leaves a lease. Expired leases return to
 // pending so a restarted process retries the same delivery instead of losing it.
 recoverExpiredLeases(now){return this.store.run("UPDATE delivery_outbox SET state='pending',leaseUntil=NULL,batchId=NULL,updatedAt=? WHERE state='delivering' AND leaseUntil<=?",now,now).changes}

 claim(ids,now,leaseMs,batchId){
  if(!ids.length)return [];
  const rows=this.byIds(ids).filter(row=>row.state==='pending');
  if(!rows.length)return [];
  const claimed=[];
  this.store.tx(()=>{for(const row of rows){
   // Only rows this caller actually moved to delivering may be delivered. A
   // concurrent claim that lost the race must not deliver the same report twice.
   const result=this.store.run("UPDATE delivery_outbox SET state='delivering',leaseUntil=?,batchId=?,updatedAt=? WHERE deliveryId=? AND state='pending'",now+leaseMs,batchId,now,row.deliveryId);
   if(result.changes===1)claimed.push(row.deliveryId);
  }});
  return this.byIds(claimed);
 }

 // Parent wake is tracked per delivery batch so a restart can tell whether the
 // wake marker was already requested instead of waking the parent again.
 wakeReceipt(batchId){return this.store.get('SELECT * FROM parent_wake_receipts WHERE batchId=?',batchId)}
 pendingWakes(){return this.store.all("SELECT * FROM parent_wake_receipts WHERE state IN ('pending','requested') ORDER BY requestedAt")}
 beginWake({batchId,parentSession,deliveryIds}){
  this.store.run("INSERT INTO parent_wake_receipts(batchId,parentSession,deliveryIds,state,requestedAt) VALUES(?,?,?,?,?) ON CONFLICT(batchId) DO NOTHING",batchId,parentSession,JSON.stringify(deliveryIds),'pending',Date.now());
  return this.wakeReceipt(batchId);
 }
 markWakeRequested(batchId){this.store.run("UPDATE parent_wake_receipts SET state='requested',requestedAt=? WHERE batchId=? AND state IN ('pending','failed')",Date.now(),batchId);return this.wakeReceipt(batchId)}
 completeWake(batchId){this.store.run("UPDATE parent_wake_receipts SET state='completed',completedAt=? WHERE batchId=?",Date.now(),batchId);return this.wakeReceipt(batchId)}
 failWake(batchId,error){this.store.run("UPDATE parent_wake_receipts SET state='failed',error=? WHERE batchId=?",String(error||'').slice(0,2000),batchId);return this.wakeReceipt(batchId)}
 noteWakeError(batchId,error){this.store.run("UPDATE parent_wake_receipts SET error=? WHERE batchId=?",String(error||'').slice(0,2000),batchId);return this.wakeReceipt(batchId)}

 markDelivered(rows,now,wake,deliveryId){
  this.store.tx(()=>{for(const row of rows){
   const attemptNo=row.attempts+1;
   this.store.run("UPDATE delivery_outbox SET state='delivered',attempts=?,deliveredAt=?,wake=?,batchId=?,leaseUntil=NULL,updatedAt=?,lastError=NULL WHERE deliveryId=?",attemptNo,now,wake?1:0,deliveryId,now,row.deliveryId);
   this.store.run('INSERT INTO delivery_attempts(deliveryId,attemptNo,startedAt,finishedAt,outcome,error,evidence) VALUES(?,?,?,?,?,?,?)',row.deliveryId,attemptNo,row.updatedAt,now,'delivered',null,deliveryId);
  }});
 }

 markRetry(rows,now,error){
  this.store.tx(()=>{for(const row of rows){
   const attempts=row.attempts+1;
   this.store.run("UPDATE delivery_outbox SET state='pending',attempts=?,nextAt=?,leaseUntil=NULL,batchId=NULL,updatedAt=?,lastError=? WHERE deliveryId=?",attempts,now+backoff(attempts),now,String(error||'').slice(0,2000),row.deliveryId);
   this.store.run('INSERT INTO delivery_attempts(deliveryId,attemptNo,startedAt,finishedAt,outcome,error,evidence) VALUES(?,?,?,?,?,?,?)',row.deliveryId,attempts,row.updatedAt,now,'failed',String(error||'').slice(0,2000),null);
  }});
 }
}
