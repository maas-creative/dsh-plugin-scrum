import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Python policy diagnoses source syntax and unsafe exception/type patterns without modifying files', () => {
 const code=String.raw`
import importlib.util,sys,tempfile,subprocess
from pathlib import Path
p=Path('skills/programming/scripts/python/check-no-excuse-rules.py').resolve()
s=importlib.util.spec_from_file_location('policy',p);m=importlib.util.module_from_spec(s);sys.modules[s.name]=m;s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 f=Path(d)/'source.py';body='try:\n pass\nexcept Exception:\n pass\n';f.write_text(body)
 assert [(v.rule,v.line,v.col) for v in m.check_file(f)]==[('silent-except',4,2),('broad-except',3,1)]
 assert f.read_text()==body
 r=subprocess.run([sys.executable,str(p),str(f)],capture_output=True,text=True);assert r.returncode==1 and 'broad-except' in r.stderr and not r.stdout
 f.write_text('x="# type: ignore"\n');assert not m.check_file(f)
 f.write_text('x=1 # type: ignore\n');assert [v.rule for v in m.check_file(f)]==['type-ignore']
 f.write_text('def invalid(\n');assert m.check_file(f)[0].rule=='syntax-error'
 f.write_text('x=1\n'*250);assert not m.check_file(f)
 f.write_text('x=1\n'*251);assert m.check_file(f)[0].rule=='oversized-module'
 f.write_text('def f(x:list[object])->object:\n return x\n');assert [(v.line,v.col) for v in m.check_file(f)]==[(1,14),(1,24)]
 f.write_text('match x:\n case _:\n  assert_never(x)\n');assert not m.check_file(f)
 f.write_text('from typing import cast,Any\nx=cast(Any,y)\n');assert m.check_file(f)[0].rule=='cast-any'
 f.write_text('@dataclass(frozen=True,slots=True)\nclass A:\n x:int\n');assert not m.check_file(f)
 f.write_text('raise KeyError("x")\n');assert m.check_file(f)[0].rule=='generic-exception'
 assert m.discover_files([d,str(f)])==[f]
 r=subprocess.run([sys.executable,str(p),str(Path(d)/'missing.py')],capture_output=True,text=True);assert r.returncode==2
`;
 const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||'python3',['-c',code],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000});
 assert.equal(r.status,0,r.stderr);
});
