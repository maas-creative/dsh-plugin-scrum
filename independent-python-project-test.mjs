import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('independent Python project scaffold keeps library mode and refuses existing targets',()=>{
const script=String.raw`
import importlib.util,tempfile,tomllib
from pathlib import Path
s=importlib.util.spec_from_file_location('project_scaffold','skills/programming/scripts/python/new-project.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 root=Path(d).resolve();calls=[]
 def uv(args,cwd=None):
  calls.append((args,cwd))
  if args[0]=='init':(Path(args[2])/'pyproject.toml').write_text('[project]\nname="fixture"\nversion="0.1.0"\n')
 m._uv=uv;m.main('fixture',root,True);project=root/'fixture';assert calls[0][0][1]=='--lib';assert calls[1][0]==['add','--dev','basedpyright','ruff','pytest','pytest-cov'];assert calls[1][1]==project
 assert tomllib.loads((project/'pyproject.toml').read_text())['tool']['basedpyright']['typeCheckingMode']=='strict'
 before=(project/'pyproject.toml').read_text()
 try:m.main('fixture',root)
 except FileExistsError:pass
 else:raise AssertionError('Existing project overwritten')
 assert (project/'pyproject.toml').read_text()==before
 try:m.main('../escape',root)
 except ValueError:pass
 else:raise AssertionError('Path injection accepted')
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||'python3',['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
