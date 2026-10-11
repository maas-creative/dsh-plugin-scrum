"""Independent browser profile discovery using conventional profile locations."""
import os
from pathlib import Path
from typing import Literal, TypedDict

BrowserKind = Literal['chromium', 'firefox']
class UnsupportedPlatform(ValueError):
    pass
class BrowserDirs(TypedDict):
    darwin: str
    linux: str
    win32: str
class BrowserSpec(TypedDict):
    kind: BrowserKind
    safe_storage: str | None
    dirs: BrowserDirs

def _spec(kind, storage, mac, linux, windows):
    return {'kind': kind, 'safe_storage': storage, 'dirs': {'darwin': mac, 'linux': linux, 'win32': windows}}

BROWSERS = {
    'chrome': _spec('chromium', 'Chrome Safe Storage', 'Google/Chrome', 'google-chrome', 'Google/Chrome/User Data'),
    'brave': _spec('chromium', 'Brave Safe Storage', 'BraveSoftware/Brave-Browser', 'BraveSoftware/Brave-Browser', 'BraveSoftware/Brave-Browser/User Data'),
    'chromium': _spec('chromium', 'Chromium Safe Storage', 'Chromium', 'chromium', 'Chromium/User Data'),
    'firefox': _spec('firefox', None, 'Firefox/Profiles', '.mozilla/firefox', 'Mozilla/Firefox/Profiles'),
}
CHROMIUM_PROFILE_DIRS = ['Default', 'Profile 1', 'Profile 2']

def platform_base(platform: str, kind: BrowserKind):
    home = Path.home()
    if platform == 'darwin':
        return home / 'Library/Application Support'
    if platform == 'linux':
        return Path(os.environ.get('XDG_CONFIG_HOME', home / '.config')) if kind == 'chromium' else home
    if platform == 'win32':
        return Path(os.environ.get('LOCALAPPDATA', home / 'AppData/Local'))
    raise UnsupportedPlatform('Unsupported cookie platform: ' + str(platform))

def browser_dir(spec: BrowserSpec, platform: str):
    if platform not in spec['dirs']:
        raise UnsupportedPlatform('Unsupported cookie platform: ' + str(platform))
    return platform_base(platform, spec['kind']) / spec['dirs'][platform]

def resolve_cookie_db(browser: str, platform: str, base_override: Path | None = None):
    if browser not in BROWSERS or platform not in ('darwin', 'linux', 'win32'):
        raise UnsupportedPlatform('Unsupported browser or platform')
    spec = BROWSERS[browser]
    directory = (Path(base_override) / spec['dirs'][platform]) if base_override is not None else browser_dir(spec, platform)
    if spec['kind'] == 'firefox':
        candidates = sorted(directory.glob('*/cookies.sqlite'))
    else:
        candidates = [directory / profile / filename for profile in CHROMIUM_PROFILE_DIRS for filename in ('Cookies', 'Network/Cookies')]
    for candidate in candidates:
        if candidate.is_file():
            return candidate
    raise FileNotFoundError('No cookie database found in the selected browser profile root')
