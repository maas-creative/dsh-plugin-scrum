import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('browser cookie discovery preserves profile preference on isolated platform layouts',()=>{
const script=String.raw`
import sys, tempfile
from pathlib import Path
sys.path.insert(0,'skills/ultimate-browsing/scripts')
import cookie_paths as m
for platform in ['darwin','linux','win32']:
 for browser in m.BROWSERS:
  with tempfile.TemporaryDirectory() as d:
   root=Path(d);directory=root/m.BROWSERS[browser]['dirs'][platform]
   names=['abc.default/cookies.sqlite','xyz.default-release/cookies.sqlite'] if browser=='firefox' else ['Default/Cookies','Default/Network/Cookies','Profile 1/Cookies']
   for name in names:
    p=directory/name;p.parent.mkdir(parents=True,exist_ok=True);p.touch()
   assert m.resolve_cookie_db(browser,platform,root)==directory/names[0]
   (directory/names[0]).unlink();assert m.resolve_cookie_db(browser,platform,root)==directory/names[1]
with tempfile.TemporaryDirectory() as d:
 try:m.resolve_cookie_db('chrome','linux',Path(d))
 except FileNotFoundError:pass
 else:raise AssertionError('Empty profile was accepted')
try:m.resolve_cookie_db('unknown','linux',Path('/tmp'))
except m.UnsupportedPlatform:pass
else:raise AssertionError('Unknown browser was accepted')
`;
const r=spawnSync(process.env.SCRUM_PUBLIC_READER_PYTHON||new URL('./work/independent-public-reader-venv/bin/python',import.meta.url).pathname,['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
