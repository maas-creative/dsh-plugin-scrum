import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('independent Python script scaffold runs, preserves existing output and rejects path injection',()=>{
const script=String.raw`
import importlib.util,tempfile,subprocess,sys,tomllib
from pathlib import Path
s=importlib.util.spec_from_file_location('script_scaffold','skills/programming/scripts/python/new-script.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'hello.py';m.main('hello',p,[],'3.12');r=subprocess.run([sys.executable,str(p)],capture_output=True,text=True,timeout=5);assert r.returncode==0 and r.stdout=='Hello from hello\n'
 body=p.read_text();meta='\n'.join(line[2:] for line in body.splitlines()[2:] if line.startswith('# ') and line!='# ///');assert tomllib.loads(meta)['requires-python']=='>=3.12'
 try:m.main('hello',p)
 except FileExistsError:pass
 else:raise AssertionError('Existing file overwritten')
 assert p.read_text()==body
 try:m.main('../escape',Path(d)/'bad.py')
 except ValueError:pass
 else:raise AssertionError('Path injection accepted')
 q=Path(d)/'deps.py';m.main('deps',q,['requests>=2; python_version >= "3.12"'],'3.12');compile(q.read_text(),str(q),'exec')
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||'python3',['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
