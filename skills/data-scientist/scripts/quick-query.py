#!/usr/bin/env python3
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).resolve().parents[3] / 'independent' / 'data-query.py'), run_name='__main__')
