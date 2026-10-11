import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
test('independent cookie crypto matches synthetic platform contracts and rejects corruption',()=>{
const script=String.raw`
import sys,tempfile,json,base64,subprocess
from pathlib import Path
sys.path.insert(0,'skills/ultimate-browsing/scripts');import cookie_crypto as m
from cryptography.hazmat.primitives.ciphers import Cipher,algorithms,modes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
assert m.derive_key('darwin',b'synthetic-secret').hex()=='783696d70baa14a426ca8e202f73152f'
assert m.derive_key('linux',b'synthetic-secret').hex()=='d2b5c9553aa57fff1fb93705f37d9d2c'
for platform in ['darwin','linux','win32']:
 key=m.derive_key(platform,b'0'*32 if platform=='win32' else b'synthetic-secret');plain=b'synthetic-cookie'
 if platform=='win32':nonce=b'1'*12;body=nonce+AESGCM(key).encrypt(nonce,plain,None)
 else:
  pad=16-len(plain)%16;enc=Cipher(algorithms.AES(key),modes.CBC(b' '*16)).encryptor();body=enc.update(plain+bytes([pad])*pad)+enc.finalize()
 for tag in [b'v10',b'v11']:assert m.decrypt_chromium_value(platform,key,tag+body)=='synthetic-cookie'
 for invalid in [b'v20'+body,b'v10x']:
  try:m.decrypt_chromium_value(platform,key,invalid)
  except ValueError:pass
  else:raise AssertionError('Invalid envelope accepted')
 if platform=='win32':
  try:m.decrypt_chromium_value(platform,key,b'v10'+body[:-1]+bytes([body[-1]^1]))
  except Exception:pass
  else:raise AssertionError('Invalid authentication tag accepted')
calls=[]
def run(args,**kwargs):calls.append(args);return subprocess.CompletedProcess(args,0,'synthetic-secret\n','')
m.subprocess.run=run;assert m.macos_keyring_secret('Fixture Safe Storage')==b'synthetic-secret';assert calls==[['security','find-generic-password','-s','Fixture Safe Storage','-w']]
def denied(args,**kwargs):return subprocess.CompletedProcess(args,1,'','private error')
m.subprocess.run=denied
try:m.macos_keyring_secret('Fixture Safe Storage')
except PermissionError as e:assert 'private error' not in str(e)
else:raise AssertionError('Keychain denial accepted')
m._dpapi_unprotect=lambda x: b'0'*32
with tempfile.TemporaryDirectory() as d:
 p=Path(d)/'Local State';p.write_text(json.dumps({'os_crypt':{'encrypted_key':base64.b64encode(b'DPAPIsynthetic').decode()}}));assert m.windows_oscrypt_key(p)==b'0'*32
`;
const r=spawnSync(process.env.SCRUM_COOKIE_PYTHON||new URL('./work/independent-cookie-venv/bin/python',import.meta.url).pathname,['-c',script],{cwd:new URL('.',import.meta.url),encoding:'utf8',timeout:10000,maxBuffer:1048576});assert.equal(r.status,0,r.stderr);
});
