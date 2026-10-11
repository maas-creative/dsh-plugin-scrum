import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {compareSemverVersions,isStrictlyNewerVersion} from './independent/lifecycle-version.mjs';
test('independent lifecycle comparator retains all observed public version results and update direction',()=>{
 const contract=JSON.parse(readFileSync(new URL('./test-fixtures/lifecycle-version-contract.json',import.meta.url),'utf8'));
 for(const row of contract.cases){assert.equal(compareSemverVersions(row.a,row.b),row.comparison,JSON.stringify(row));assert.equal(isStrictlyNewerVersion(row.a,row.b),row.newer)}
 assert.equal(compareSemverVersions(null,'1.0.0'),null);
 assert.equal(compareSemverVersions('9007199254740993.0.0','9007199254740992.0.0'),1);
});
