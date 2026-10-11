import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('cookie domain SQL isolates explicit domains, subdomains and wildcard literals',()=>{
 const script=String.raw`
import importlib.util,sqlite3
from pathlib import Path
p=Path('skills/ultimate-browsing/scripts/cookie_domains.py');s=importlib.util.spec_from_file_location('domains',p);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
db=sqlite3.connect(':memory:');db.execute('create table cookies(host_key text)')
values=['example.com','.example.com','a.example.com','badexample.com','example.com.attacker.test','another.test','a%_b.example','x.a%_b.example','x.axxb.example']
db.executemany('insert into cookies values(?)',[(x,) for x in values])
clause,params=m.domain_where_clause('host_key',['Example.COM']);found=[r[0] for r in db.execute('select host_key from cookies where '+clause,params)];assert found==values[:3],found
clause,params=m.domain_where_clause('host_key',['a%_b.example']);assert [r[0] for r in db.execute('select host_key from cookies where '+clause,params)]==values[6:8]
for column,domains in [('host_key;drop table cookies', ['example.com']),('host_key',[]),('host_key',[''])]:
 try:m.domain_where_clause(column,domains)
 except m.CookieDomainError:pass
 else:raise AssertionError('Unsafe SQL request accepted')
assert db.execute('select count(*) from cookies').fetchone()[0]==len(values)
`;
 const r=spawnSync(process.env.SCRUM_PUBLIC_READER_PYTHON||'python3',['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
