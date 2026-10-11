"""Independent uv application/library scaffold with strict local checks."""
import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

def _uv(arguments, cwd=None):
    command=[os.environ.get('SCRUM_UV_EXECUTABLE','uv'), *arguments]
    result=subprocess.run(command,cwd=cwd,capture_output=True,text=True,timeout=120)
    if result.returncode:
        raise RuntimeError('uv '+arguments[0]+' failed with exit code '+str(result.returncode)+'; the partial project was retained')

def main(name: str, path: Path = Path('.'), lib: bool = False):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*',name):
        raise ValueError('Use a simple project name without directory components')
    parent=Path(path).resolve(strict=True)
    if not parent.is_dir():raise ValueError('The parent path must be a directory')
    destination=parent/name
    destination.mkdir(mode=0o700)
    _uv(['init','--lib' if lib else '--app',str(destination),'--no-workspace','--python',sys.executable])
    pyproject=destination/'pyproject.toml'
    with pyproject.open('a',encoding='utf-8') as stream:
        stream.write('\n[tool.basedpyright]\ntypeCheckingMode = "strict"\ninclude = ["."]\nexclude = [".venv"]\n\n[tool.ruff]\nline-length = 100\n\n[tool.ruff.lint]\nselect = ["E", "F", "I", "B", "UP", "ANN"]\n\n[tool.pytest.ini_options]\ntestpaths = ["tests"]\n')
    tests=destination/'tests';tests.mkdir()
    (tests/'__init__.py').write_text('')
    if lib:
        module=name.replace('-', '_').lower()
        body='import importlib\n\n\ndef test_package_imports() -> None:\n    module = importlib.import_module('+json.dumps(module)+')\n    assert module.__name__ == '+json.dumps(module)+'\n'
    else:
        (destination/'main.py').write_text('def main() -> None:\n    print('+json.dumps('Hello from '+name)+')\n\nif __name__ == \"__main__\":\n    main()\n')
        body='import subprocess\nimport sys\nfrom pathlib import Path\n\n\ndef test_application_runs() -> None:\n    root = Path(__file__).resolve().parents[1]\n    result = subprocess.run(\n        [sys.executable, str(root / \"main.py\")],\n        capture_output=True, text=True, check=True,\n    )\n    assert result.stdout == '+json.dumps('Hello from '+name+'\n')+'\n'
    (tests/'test_startup.py').write_text(body)
    _uv(['add','--dev','basedpyright','ruff','pytest','pytest-cov'],cwd=destination)
    print(destination)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Create a standalone uv application or library with local development checks')
    parser.add_argument('name');parser.add_argument('--path','-p',type=Path,default=Path('.'));parser.add_argument('--lib',action='store_true')
    args=parser.parse_args();main(args.name,args.path,args.lib)
