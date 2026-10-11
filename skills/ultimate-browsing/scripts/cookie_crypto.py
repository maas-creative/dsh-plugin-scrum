"""Independent Chromium crypto adapters using hashlib and cryptography.

Calling keyring functions can request OS permission. No keyring is read at import.
"""
import base64
import ctypes
import hashlib
import hmac
import json
import subprocess
import sys
from pathlib import Path
from cookie_paths import UnsupportedPlatform

def derive_key(platform: str, secret: bytes):
    if platform == 'win32':
        if len(secret) not in (16, 24, 32):
            raise ValueError('Invalid AES key length')
        return secret
    if platform not in ('darwin', 'linux'):
        raise UnsupportedPlatform('Unsupported cookie crypto platform')
    return hashlib.pbkdf2_hmac('sha1', secret, b'saltysalt', 1003 if platform == 'darwin' else 1, 16)

def decrypt_chromium_value(platform: str, key: bytes, encrypted: bytes, host_key: str | None = None, require_domain_hash: bool = False):
    if platform not in ('darwin', 'linux', 'win32'):
        raise UnsupportedPlatform('Unsupported cookie crypto platform')
    if not encrypted.startswith((b'v10', b'v11')):
        raise ValueError('Unsupported Chromium cookie encryption envelope')
    body = encrypted[3:]
    if platform == 'win32':
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        if len(body) < 28:
            raise ValueError('Truncated authenticated cookie envelope')
        plain = AESGCM(key).decrypt(body[:12], body[12:], None)
    else:
        from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
        from cryptography.hazmat.primitives import padding
        if not body or len(body) % 16:
            raise ValueError('Invalid cookie ciphertext length')
        decryptor = Cipher(algorithms.AES(key), modes.CBC(b' ' * 16)).decryptor()
        padded = decryptor.update(body) + decryptor.finalize()
        unpadder = padding.PKCS7(128).unpadder()
        plain = unpadder.update(padded) + unpadder.finalize()
    if host_key is not None:
        digest = hashlib.sha256(host_key.encode('utf-8')).digest()
        if len(plain) >= 32 and hmac.compare_digest(plain[:32], digest):
            plain = plain[32:]
        elif require_domain_hash:
            raise ValueError('Cookie domain integrity check failed')
    return plain.decode('utf-8')

def macos_keyring_secret(safe_storage: str):
    result = subprocess.run(['security', 'find-generic-password', '-s', safe_storage, '-w'], capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise PermissionError('The selected browser keychain secret was not available')
    return result.stdout.rstrip('\r\n').encode('utf-8')

def linux_keyring_secret(safe_storage: str):
    # The legacy public interface supports Chromium's basic password store only.
    # Do not silently invoke another account's secret service.
    return b'peanuts'

def _dpapi_unprotect(encrypted: bytes):
    if sys.platform != 'win32':
        raise UnsupportedPlatform('Windows DPAPI requires Windows')
    from ctypes import wintypes
    class Blob(ctypes.Structure):
        _fields_ = [('length', wintypes.DWORD), ('data', ctypes.POINTER(ctypes.c_ubyte))]
    buffer = (ctypes.c_ubyte * len(encrypted)).from_buffer_copy(encrypted)
    source = Blob(len(encrypted), buffer)
    destination = Blob()
    crypt = ctypes.WinDLL('crypt32', use_last_error=True)
    kernel = ctypes.WinDLL('kernel32', use_last_error=True)
    decrypt = crypt.CryptUnprotectData
    decrypt.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    decrypt.restype = wintypes.BOOL
    kernel.LocalFree.argtypes = [ctypes.c_void_p]
    kernel.LocalFree.restype = ctypes.c_void_p
    if not decrypt(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(destination)):
        raise PermissionError('Windows denied access to the browser encryption key')
    try:
        return ctypes.string_at(destination.data, destination.length)
    finally:
        kernel.LocalFree(destination.data)

def windows_oscrypt_key(local_state_path: Path):
    with Path(local_state_path).open('r', encoding='utf-8') as stream:
        document = json.load(stream)
    encrypted = base64.b64decode(document['os_crypt']['encrypted_key'], validate=True)
    if not encrypted.startswith(b'DPAPI'):
        raise ValueError('Unsupported Windows browser key envelope')
    return derive_key('win32', _dpapi_unprotect(encrypted[5:]))
