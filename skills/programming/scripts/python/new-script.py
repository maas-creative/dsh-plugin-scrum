"""Independent Python script scaffold with PEP 723 metadata."""
import argparse
import json
import os
import re
import tempfile
from pathlib import Path

def main(name: str, output: Path | None = None, deps: list[str] | None = None, py: str = '3.13'):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*', name):
        raise ValueError('Use a simple script name without a directory or extension')
    if not re.fullmatch(r'3\.[0-9]+', py):
        raise ValueError('Use a Python 3 minor version such as 3.13')
    dependencies = list(deps or [])
    if any(not isinstance(d, str) or not d.strip() or '\n' in d or '\r' in d for d in dependencies):
        raise ValueError('Each dependency must be a nonempty single-line requirement')
    rows = ['#!/usr/bin/env python3', '# /// script', '# requires-python = '+json.dumps('>='+py), '# dependencies = [']
    rows.extend('#     '+json.dumps(d,ensure_ascii=False)+',' for d in dependencies)
    rows.extend(['# ]', '# ///', '', 'def main() -> int:', '    print('+json.dumps('Hello from '+name)+')', '    return 0', '', 'if __name__ == "__main__":', '    raise SystemExit(main())', ''])
    content = '\n'.join(rows)
    if output is None:
        fd, filename = tempfile.mkstemp(prefix=name+'-',suffix='.py')
        destination = Path(filename)
    else:
        destination = Path(output)
        fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os,'O_NOFOLLOW',0), 0o700)
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as stream:
            stream.write(content);stream.flush();os.fsync(stream.fileno())
        destination.chmod(0o700)
    except BaseException:
        destination.unlink(missing_ok=True)
        raise
    print(destination)

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description='Create an executable Python script with inline dependency metadata')
    parser.add_argument('name');parser.add_argument('--output','-o',type=Path);parser.add_argument('--deps','-d',action='append',default=[]);parser.add_argument('--py',default='3.13')
    args=parser.parse_args();main(args.name,args.output,args.deps,args.py)
