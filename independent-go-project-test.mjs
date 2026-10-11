import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('independent Go generator expands owned templates and preserves existing files',()=>{
const script=String.raw`
import importlib.util,tempfile
from pathlib import Path
s=importlib.util.spec_from_file_location('go_scaffold','skills/programming/scripts/go/new-project.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 root=Path(d);calls=[];m._init_go_module=lambda p,module:calls.append(module)
 m.main('fixture',str(root),'example.test/fixture','HTTP');project=root/'fixture';assert calls==['example.test/fixture'];assert 'example.test/fixture/internal/cmd' in (project/'cmd/server/main.go').read_text()
 before=(project/'cmd/server/main.go').read_text()
 for name in ['fixture','../escape']:
  try:m.main(name,str(root))
  except (FileExistsError,ValueError):pass
  else:raise AssertionError('Unsafe destination accepted')
 assert (project/'cmd/server/main.go').read_text()==before
 try:m._write_files(project,'fixture','example.test/fixture','HTTP')
 except FileExistsError:pass
 else:raise AssertionError('Existing generated files overwritten')
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||'python3',['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
