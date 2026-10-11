import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {Store} from './ledger.mjs';import {DeliveryGates,readDeliveryGates} from './delivery-gates.mjs';
test('notification batch and cleared pointer cannot masquerade as Git delivery or block parent settlement',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'scrum-delivery-namespace-')),s=new Store(join(dir,'db'));
 try{
  s.set('scrumDelivery:cleared',null);const batch={id:'batch',reportIds:['report'],wake:true};s.set('scrumDelivery:parent',batch);
  assert.deepEqual(readDeliveryGates(s),[]);
  const gates=new DeliveryGates(s,{dataDirectory:dir});gates.start('parent','owner',{mode:'ship'});
  assert.deepEqual(s.setting('scrumDelivery:parent'),batch);assert.equal(s.setting('scrumDeliveryGate:parent').mode,'ship');
  assert.equal(readDeliveryGates(s).length,1);assert.equal(gates.get('parent','owner').mode,'ship');
  assert.throws(()=>gates.get('parent','foreign'),/outside parent/);
  const legacy={id:'legacy',parentSession:'other',mode:'make-pr',version:1};s.set('scrumDelivery:legacy',legacy);
  assert.equal(gates.get('legacy','other').mode,'make-pr');gates.update('legacy','other',record=>record.stage='verification');
  assert.equal(s.setting('scrumDelivery:legacy').version,1);assert.equal(s.setting('scrumDeliveryGate:legacy').version,2);
  assert.equal(readDeliveryGates(s).find(record=>record.id==='legacy').version,2);
  s.set('scrumDeliveryGate:invalid',null);assert.throws(()=>readDeliveryGates(s),/Invalid persisted delivery gate/);
 }finally{s.close();await rm(dir,{recursive:true,force:true});}
});
