import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Go source policy requires suppression reasons and TODO owners without modifying sources',()=>{
 const code=String.raw`
import tempfile,subprocess,importlib.util
from pathlib import Path
s=importlib.util.spec_from_file_location('go_policy','independent/go_policy.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'source.go';body='package main\n//nolint:all\n// TODO: work\nvar x interface{}\n';p.write_text(body)
 assert m.inspect(p)==[('nolint-no-reason',2),('todo-no-owner',3),('old-interface-empty',4)];assert p.read_text()==body
 p.write_text('package main\n//nolint:all // reason\n// TODO(alice): work\nvar x any\n');assert not m.inspect(p)
 r=subprocess.run(['bash','skills/programming/scripts/go/check-no-excuse-rules.sh',str(p)],capture_output=True,text=True);assert r.returncode==0
 p.write_text(body);r=subprocess.run(['bash','skills/programming/scripts/go/check-no-excuse-rules.sh',str(p)],capture_output=True,text=True);assert r.returncode==1 and '[todo-no-owner]' in r.stderr
 r=subprocess.run(['bash','skills/programming/scripts/go/check-no-excuse-rules.sh',str(p.parent/'missing.go')],capture_output=True,text=True);assert r.returncode==2
`;
 const r=spawnSync('python3',['-c',code],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);
});
