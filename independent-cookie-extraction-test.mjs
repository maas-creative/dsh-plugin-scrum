import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('independent cookie extraction preserves WAL data, exact domains, encrypted records and private export',()=>{
const script=String.raw`
import sys,sqlite3,tempfile,json,os,subprocess,hashlib
from pathlib import Path
sys.path.insert(0,'skills/ultimate-browsing/scripts');import extract_cookies as m
from cryptography.hazmat.primitives.ciphers import Cipher,algorithms,modes
with tempfile.TemporaryDirectory() as d:
 root=Path(d);p=root/'firefox.sqlite';db=sqlite3.connect(p);db.execute('pragma journal_mode=WAL');db.execute('create table moz_cookies(name text,value text,host text,path text,expiry integer,isSecure integer,isHttpOnly integer,sameSite integer)')
 db.executemany('insert into moz_cookies values(?,?,?,?,?,?,?,?)',[('fixture','synthetic',h,'/',2000000000,1,1,2) for h in ['.example.com','a.example.com','badexample.com','example.com.attacker.test']]);db.commit()
 result=m.extract_firefox(p,['example.com']);assert [c['domain'] for c in result]==['.example.com','a.example.com'];assert result[0]['sameSite']=='Strict'
 assert db.execute('select count(*) from moz_cookies').fetchone()[0]==4;db.close()
 out=root/'export.json';m.write_cookie_file(out,result);assert json.loads(out.read_text())==result;assert out.stat().st_mode&0o777==0o600
 link=root/'link';link.symlink_to(out)
 try:m.write_cookie_file(link,[])
 except ValueError:pass
 else:raise AssertionError('Symlink output accepted')
 assert json.loads(out.read_text())==result
 p=root/'Cookies';db=sqlite3.connect(p);db.execute('create table cookies(name text,value text,host_key text,path text,expires_utc integer,is_secure integer,is_httponly integer,samesite integer,encrypted_value blob)')
 key=m.derive_key('darwin',b'synthetic-secret');plain=b'synthetic-cookie';pad=16-len(plain)%16;enc=Cipher(algorithms.AES(key),modes.CBC(b' '*16)).encryptor();cipher=b'v10'+enc.update(plain+bytes([pad])*pad)+enc.finalize()
 db.execute('insert into cookies values(?,?,?,?,?,?,?,?,?)',('fixture','','.example.com','/',13344473600000000,1,1,1,cipher));db.commit();db.close()
 result=m.extract_chromium(p,['example.com'],'darwin',key);assert result[0]['value']=='synthetic-cookie';assert result[0]['expires']==1700000000
 db=sqlite3.connect(p);db.execute('create table meta(key text,value text)');db.execute("insert into meta values('version','24')");plain=hashlib.sha256(b'.example.com').digest()+b'synthetic-cookie';pad=16-len(plain)%16;enc=Cipher(algorithms.AES(key),modes.CBC(b' '*16)).encryptor();cipher=b'v10'+enc.update(plain+bytes([pad])*pad)+enc.finalize();db.execute('update cookies set encrypted_value=?',(cipher,));db.commit();db.close();assert m.extract_chromium(p,['example.com'],'darwin',key)[0]['value']=='synthetic-cookie'
 db=sqlite3.connect(p);db.execute("update cookies set host_key='a.example.com'");db.commit();db.close()
 try:m.extract_chromium(p,['example.com'],'darwin',key)
 except ValueError:pass
 else:raise AssertionError('Domain hash mismatch accepted')
 db=sqlite3.connect(p);db.execute("update cookies set host_key='.example.com'");db.commit();db.close()
 profile=root/'Google/Chrome/Default';profile.mkdir(parents=True);(profile/'Cookies').write_bytes(p.read_bytes());calls=[]
 def reader(storage):calls.append(storage);return b'synthetic-secret'
 assert m.extract_cookies('chrome',['example.com'],'darwin',reader,root)[0]['value']=='synthetic-cookie';assert calls==['Chrome Safe Storage']
 assert callable(m.default_keyring_reader('linux',m.BROWSERS['chrome']))
 transmitted=[]
 def run(args,**kw):transmitted.append(json.loads(kw['input']));return subprocess.CompletedProcess(args,0,'','')
 m.subprocess.run=run;session=dict(result[0],expires=0);m.inject_cookies([session],9242);assert 'expires' not in transmitted[0]['cookies'][0]
 for port in [0,65536,True]:
  try:m.inject_cookies([session],port)
  except ValueError:pass
  else:raise AssertionError('Invalid port accepted')
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||new URL('./work/independent-cookie-venv/bin/python',import.meta.url).pathname,['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
