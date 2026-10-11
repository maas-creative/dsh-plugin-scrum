import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('independent Rust generator refuses traversal and preserves existing project files',()=>{
const script=String.raw`
import importlib.util,tempfile
from pathlib import Path
s=importlib.util.spec_from_file_location('rust_scaffold','skills/programming/scripts/rust/new-project.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as d:
 root=Path(d);project=root/'fixture';project.mkdir();marker=project/'keep';marker.write_text('retained')
 for name in ['fixture','../escape']:
  try:m.main(name,root)
  except (FileExistsError,ValueError):pass
  else:raise AssertionError('Unsafe destination accepted')
 assert marker.read_text()=='retained'
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||'python3',['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
test('generated Rust application remains nonpublishable without silently licensing user code',()=>{
const script=String.raw`
import importlib.util,tempfile,tomllib
from pathlib import Path
from unittest.mock import patch
from subprocess import CompletedProcess
s=importlib.util.spec_from_file_location('rust_scaffold','skills/programming/scripts/rust/new-project.py');m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
def initialize(args,**kwargs):
 p=Path(args[2]);(p/'src').mkdir();(p/'Cargo.toml').write_text('[package]\nname="fixture"\nversion="0.1.0"\nedition="2024"\n\n[dependencies]\n');return CompletedProcess(args,0,'','')
with tempfile.TemporaryDirectory() as d,patch.object(m.subprocess,'run',initialize):
 m.main('fixture',Path(d));p=Path(d)/'fixture';manifest=tomllib.loads((p/'Cargo.toml').read_text());assert manifest['package']['publish'] is False;assert 'license' not in manifest['package'];assert 'private application' in (p/'README.md').read_text();assert manifest['lints']['rust']['unsafe_code']=='forbid'
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||'python3',['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
