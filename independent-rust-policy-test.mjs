import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
test('Rust source policy preserves files and enforces diagnostic exemptions by scope',()=>{
 const source=String.raw`
import tempfile,subprocess,importlib.util
from pathlib import Path
s=importlib.util.spec_from_file_location('rust_policy','independent/rust_policy.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'source.rs'
 body='#[cfg(test)]\nmod tests {\n fn a(){Some(1).unwrap();}\n}\nfn main(){Some(1).unwrap();}\n';p.write_text(body)
 assert m.inspect(p)==[('unwrap',5)];assert p.read_text()==body
 p.write_text('fn main(){\n #[expect(clippy::expect_used, reason="invariant")]\n Some(1).expect("x");\n}\n');assert m.inspect(p)==[]
 p.write_text('// SAFETY: fixture\nfn main(){unsafe {}}\n');assert not m.inspect(p)
 p.write_text('fn main(){unsafe {}}\n');assert m.inspect(p)==[('unsafe-no-safety-comment',1)]
 r=subprocess.run(['bash','skills/programming/scripts/rust/check-no-excuse-rules.sh',str(p)],capture_output=True,text=True);assert r.returncode==1 and '[unsafe-no-safety-comment]' in r.stderr
 r=subprocess.run(['bash','skills/programming/scripts/rust/check-no-excuse-rules.sh',str(p.parent/'missing.rs')],capture_output=True,text=True);assert r.returncode==2
`;
 const r=spawnSync('python3',['-c',source],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000});assert.equal(r.status,0,r.stderr);
});
