#!/usr/bin/env python3
"""Compatibility entry point for Scrum's bundled Node session finder."""
from pathlib import Path
import subprocess
import sys
if __name__ == "__main__":
    raise SystemExit(subprocess.call(["node", str(Path(__file__).with_suffix(".mjs")), *sys.argv[1:]]))
