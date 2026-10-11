"""Independent Rust binary scaffold using native Cargo initialization."""
import argparse
import os
import re
import subprocess
from pathlib import Path

def main(name: str, path: Path = Path.cwd()):
    if not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*', name):
        raise ValueError('Use a simple Rust project name')
    parent=Path(path).resolve(strict=True)
    if not parent.is_dir():raise ValueError('A parent directory is required')
    destination=parent/name;destination.mkdir(mode=0o700)
    cargo=os.environ.get('SCRUM_CARGO_EXECUTABLE','cargo')
    result=subprocess.run([cargo,'init',str(destination),'--name',name],capture_output=True,text=True,timeout=60)
    if result.returncode:raise RuntimeError('Cargo initialization failed; the partial directory was retained')
    manifest=destination/'Cargo.toml'
    manifest.write_text(manifest.read_text().replace('[package]\n','[package]\npublish = false\n',1))
    with (destination/'Cargo.toml').open('a',encoding='utf-8') as stream:
        stream.write('\n[lints.rust]\nunsafe_code = "forbid"\nunused_must_use = "deny"\n\n[lints.clippy]\nall = "deny"\n')
    (destination/'rust-toolchain.toml').write_text('[toolchain]\nchannel = "stable"\ncomponents = ["rustfmt", "clippy"]\n')
    (destination/'rustfmt.toml').write_text('max_width = 100\n')
    (destination/'deny.toml').write_text('[advisories]\nyanked = "deny"\n\n[licenses]\nallow = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "Unicode-3.0", "AGPL-3.0-only", "AGPL-3.0-or-later"]\n\n[licenses.private]\nignore = true\n\n[bans]\nmultiple-versions = "warn"\n')
    (destination/'README.md').write_text('# '+name+'\n\nThis generated application starts with `publish = false`; no public license is assigned automatically. `cargo deny check` audits external dependencies while excluding the private application from license requirements. Before publishing, choose a license, add its notice and enable publication deliberately.\n\nVerify with `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test` and `cargo deny check`.\n')
    text='fn main() {\n    println!(\"Hello from '+name+'\");\n}\n'
    (destination/'src/main.rs').write_text(text)
    print(destination)

if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Create a standalone Rust project with local compiler and formatting checks')
    parser.add_argument('name');parser.add_argument('--path','-p',type=Path,default=Path.cwd())
    args=parser.parse_args();main(args.name,args.path)
