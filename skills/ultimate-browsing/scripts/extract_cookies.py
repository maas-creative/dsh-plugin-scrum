"""Independent, domain-scoped cookie export and explicit loopback CDP import."""
import argparse
import json
import os
import sqlite3
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Callable, NotRequired, TypedDict
from urllib.parse import quote
from cookie_crypto import decrypt_chromium_value, derive_key, linux_keyring_secret, macos_keyring_secret, windows_oscrypt_key
from cookie_domains import domain_where_clause
from cookie_paths import BROWSERS, BrowserSpec, UnsupportedPlatform, platform_base, resolve_cookie_db

class CookieRecord(TypedDict):
    name: str
    value: str
    domain: str
    path: str
    expires: int
    secure: bool
    httpOnly: bool
    sameSite: str
class CdpCookie(TypedDict):
    name: str
    value: str
    domain: str
    path: str
    secure: bool
    httpOnly: bool
    sameSite: str
    expires: NotRequired[int]

def _secure_cookie_db_copy(db_path: Path):
    fd, name = tempfile.mkstemp(prefix='scrum-cookie-snapshot-', suffix='.sqlite')
    os.close(fd)
    source = destination = None
    try:
        source = sqlite3.connect('file:' + quote(str(Path(db_path).resolve()), safe='/') + '?mode=ro', uri=True, timeout=10)
        destination = sqlite3.connect(name)
        deadline = time.monotonic() + 15
        def progress(status, remaining, total):
            if time.monotonic() > deadline: raise TimeoutError('Cookie snapshot exceeded its time budget')
        source.backup(destination, progress=progress)
        return Path(name)
    except BaseException:
        Path(name).unlink(missing_ok=True)
        raise
    finally:
        if source is not None: source.close()
        if destination is not None: destination.close()

def write_cookie_file(path: Path, cookies: list[CookieRecord]):
    path = Path(path)
    if path.is_symlink():
        raise ValueError('Cookie output must not be a symlink')
    fd, temporary = tempfile.mkstemp(prefix='.scrum-cookie-export-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as stream:
            json.dump(cookies, stream, ensure_ascii=False, indent=2)
            stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        Path(temporary).unlink(missing_ok=True)

def _records(db_path, domains, chromium, platform=None, key=None):
    copied = _secure_cookie_db_copy(db_path)
    try:
        with sqlite3.connect(copied) as db:
            db.row_factory = sqlite3.Row
            table = 'cookies' if chromium else 'moz_cookies'
            column = 'host_key' if chromium else 'host'
            where, arguments = domain_where_clause(column, domains)
            version = 0
            if chromium and db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='meta'").fetchone():
                meta = db.execute("SELECT value FROM meta WHERE key='version'").fetchone()
                if meta is not None: version = int(meta[0])
            rows = db.execute('SELECT * FROM ' + table + ' WHERE ' + where, arguments)
            result = []
            for row in rows:
                data = dict(row)
                value = data.get('value') or ''
                if chromium and data.get('encrypted_value'):
                    value = decrypt_chromium_value(platform, key, bytes(data['encrypted_value']), data[column], version >= 24)
                expiry = int(data.get('expires_utc' if chromium else 'expiry', 0))
                if chromium and expiry: expiry = expiry // 1000000 - 11644473600
                result.append({'name': data['name'], 'value': value, 'domain': data[column], 'path': data.get('path') or '/', 'expires': expiry, 'secure': bool(data.get('is_secure', data.get('secure', 0)) if chromium else data.get('isSecure', 0)), 'httpOnly': bool(data.get('is_httponly' if chromium else 'isHttpOnly', 0)), 'sameSite': {0:'None',1:'Lax',2:'Strict'}.get(data.get('samesite' if chromium else 'sameSite'), 'None')})
            return result
    finally:
        copied.unlink(missing_ok=True)

def extract_firefox(db_path: Path, domains: list[str]):
    return _records(db_path, domains, False)

def extract_chromium(db_path: Path, domains: list[str], platform: str, key: bytes):
    return _records(db_path, domains, True, platform, key)

def _browser_spec(browser: str):
    if browser not in BROWSERS: raise UnsupportedPlatform('Unsupported cookie browser')
    return BROWSERS[browser]

def default_keyring_reader(platform: str, spec: BrowserSpec):
    if platform == 'darwin': return macos_keyring_secret
    if platform == 'linux': return linux_keyring_secret
    if platform == 'win32':
        return lambda storage: windows_oscrypt_key(platform_base(platform, spec['kind']) / spec['dirs'][platform] / 'Local State')
    raise UnsupportedPlatform('Unsupported cookie keyring platform')

def extract_cookies(browser: str, domains: list[str], platform: str = sys.platform, keyring_reader: Callable[[str], bytes] | None = None, base_override: Path | None = None):
    domain_where_clause('host_key', domains)
    spec = _browser_spec(browser)
    database = resolve_cookie_db(browser, platform, base_override)
    if spec['kind'] == 'firefox': return extract_firefox(database, domains)
    if platform == 'win32' and keyring_reader is None:
        base = Path(base_override) if base_override is not None else platform_base(platform, spec['kind'])
        key = windows_oscrypt_key(base / spec['dirs'][platform] / 'Local State')
    else:
        secret = keyring_reader(spec['safe_storage']) if keyring_reader else default_keyring_reader(platform, spec)(spec['safe_storage'])
        key = derive_key(platform, secret)
    return extract_chromium(database, domains, platform, key)

_CDP_PROGRAM = r'''
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);const input=Buffer.concat(chunks);if(input.length>16*1024*1024)throw Error('Cookie payload too large');const {port,cookies}=JSON.parse(input);
const response=await fetch('http://127.0.0.1:'+port+'/json/version',{signal:AbortSignal.timeout(10000),redirect:'error'});if(!response.ok)throw Error('CDP discovery failed');const text=await response.text();if(text.length>1048576)throw Error('CDP discovery too large');const endpoint=new URL(JSON.parse(text).webSocketDebuggerUrl);if(endpoint.protocol!=='ws:'||endpoint.username||endpoint.password||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)||endpoint.port!==String(port))throw Error('CDP endpoint is not the requested loopback server');
await new Promise((resolve,reject)=>{const socket=new WebSocket(endpoint);const timer=setTimeout(()=>{socket.close();reject(Error('CDP timed out'))},10000);const finish=error=>{clearTimeout(timer);socket.close();error?reject(error):resolve()};socket.addEventListener('error',()=>finish(Error('CDP connection failed')));socket.addEventListener('open',()=>socket.send(JSON.stringify({id:1,method:'Storage.setCookies',params:{cookies}})));socket.addEventListener('message',event=>{let reply;try{reply=JSON.parse(event.data)}catch{return}if(reply.id===1)finish(reply.error?Error('CDP rejected cookie import'):null)})});
'''

def inject_cookies(cookies: list[CookieRecord], cdp_port: int):
    if isinstance(cdp_port, bool) or not isinstance(cdp_port, int) or not 1 <= cdp_port <= 65535:
        raise ValueError('A valid loopback CDP port is required')
    records = []
    for record in cookies:
        cookie = {k: record[k] for k in ['name','value','domain','path','secure','httpOnly','sameSite']}
        if record['expires'] > 0: cookie['expires'] = record['expires']
        records.append(cookie)
    payload = json.dumps({'port':cdp_port,'cookies':records})
    if len(payload.encode('utf-8')) > 16 * 1024 * 1024: raise ValueError('Cookie import exceeds the payload limit')
    result = subprocess.run(['node', '--input-type=module', '-e', _CDP_PROGRAM], input=payload, capture_output=True, text=True, timeout=30)
    if result.returncode: raise RuntimeError('Cookie import failed; verify the explicitly selected loopback CDP server')

def main():
    parser = argparse.ArgumentParser(description='Export explicit domains from an authorized browser profile')
    parser.add_argument('--browser', required=True, choices=sorted(BROWSERS))
    parser.add_argument('--domain', required=True, action='append')
    parser.add_argument('--output', type=Path)
    parser.add_argument('--inject', action='store_true')
    parser.add_argument('--cdp', type=int, default=9242)
    args = parser.parse_args()
    cookies = extract_cookies(args.browser, args.domain)
    if args.output: write_cookie_file(args.output, cookies)
    if args.inject: inject_cookies(cookies, args.cdp)
    if not args.output and not args.inject: print(json.dumps(cookies, ensure_ascii=False, indent=2))

if __name__ == '__main__': main()
