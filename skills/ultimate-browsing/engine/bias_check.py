"""Independent infrastructure-only and personal-path gate for host interfaces."""
import pathlib
import re
import sys
from urllib.parse import urlsplit
INFRASTRUCTURE={"archive.org","web.archive.org","archive.ph","archive.md","archive.li","archive.is","r.jina.ai","relay.invalid"}
def check(folder=None):
    root=pathlib.Path(folder) if folder else pathlib.Path(__file__).resolve().parent
    failures=[]
    for path in root.rglob("*"):
        if not path.is_file() or path.suffix not in (".py",".yaml",".json",".js") or path.name=="bias_check.py":continue
        text=path.read_text("utf-8")
        if re.search(r"/(?:Users|home)/[A-Za-z0-9_-]+/",text):failures.append(str(path)+": personal path")
        for url in re.findall(r"https?://[^\s\"'<>]+",text):
            host=urlsplit(url).hostname
            if host and host not in INFRASTRUCTURE and host!="{host}":failures.append(str(path)+": target-site URL")
    return failures
if __name__=="__main__":
    errors=check()
    print("Infrastructure interface gate: "+("passed" if not errors else "failed"))
    for error in errors:print(error,file=sys.stderr)
    raise SystemExit(bool(errors))
