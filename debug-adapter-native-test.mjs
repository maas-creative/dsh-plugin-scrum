import test from 'node:test';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
test('actual Python DAP adapter stops, inspects variables, evaluates and closes its owned debuggee',{timeout:60000},()=>{
 const proof=JSON.parse(execFileSync(process.execPath,['debug-adapter-native-acceptance.mjs'],{encoding:'utf8',timeout:55000}));
 for(const key of ['actualDebugpy','initialize','breakpointVerified','stopped','variablesInspected','continued','terminated','disconnected','ownedAdapterClosed'])assert.equal(proof[key],true,key);
 assert.equal(proof.synthetic,false);assert.equal(proof.evaluation,'42');
});
