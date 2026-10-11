#!/usr/bin/env bash
# Scrum's independently implemented Go source-policy CLI.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$script_dir/../../../../independent/go_policy.py" "$@"
