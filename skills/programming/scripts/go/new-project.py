"""Independent Go service scaffold with explicit module initialization."""
import argparse
import os
import re
import subprocess
from pathlib import Path
from string import Template

def _render(template_file):
    return Path(template_file).read_text(encoding='utf-8')

def _init_go_module(project_dir, module):
    result=subprocess.run([os.environ.get('SCRUM_GO_EXECUTABLE','go'),'mod','init',module],cwd=project_dir,capture_output=True,text=True,timeout=30)
    if result.returncode:raise RuntimeError('Go module initialization failed; partial files were retained')

def _create_layout(project_dir):
    for folder in ['cmd/server','internal/cmd','internal/config','.github/workflows']:
        (Path(project_dir)/folder).mkdir(parents=True,exist_ok=True)

def _write_files(project_dir, name, module, purpose):
    mapping={'main.go.tmpl':'cmd/server/main.go','run.go':'internal/cmd/run.go','config.go':'internal/config/config.go','README.md.tmpl':'README.md','AGENTS.md.tmpl':'AGENTS.md','gitignore':'.gitignore','ci.yml':'.github/workflows/ci.yml'}
    source=Path(__file__).parent/'templates'
    for template in source.iterdir():
        if not template.is_file():continue
        destination=Path(project_dir)/mapping.get(template.name,template.name)
        body=Template(_render(template)).substitute(name=name,module=module,purpose=purpose)
        with destination.open('x',encoding='utf-8') as stream:stream.write(body)

def main(name: str, path: str='.', module: str='', purpose: str='HTTP'):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*',name):raise ValueError('Use a simple project name')
    module=module or name
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._~/-]*',module) or '..' in module.split('/'):
        raise ValueError('Invalid Go module path')
    if '\n' in purpose or '\r' in purpose:raise ValueError('Use a single-line purpose')
    parent=Path(path).resolve(strict=True)
    if not parent.is_dir():raise ValueError('A parent directory is required')
    project_dir=parent/name;project_dir.mkdir(mode=0o700)
    _init_go_module(project_dir,module);_create_layout(project_dir);_write_files(project_dir,name,module,purpose)
    print(project_dir)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Create a Go service with local configuration and CI checks')
    parser.add_argument('name');parser.add_argument('--path',default='.');parser.add_argument('--module',default='');parser.add_argument('--purpose',default='HTTP')
    args=parser.parse_args();main(args.name,args.path,args.module,args.purpose)
