#!/usr/bin/env bash
# Independent Scrum development validation entry point; not a runtime feature.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$script_dir/../.."
exec npm test -- "$@"
