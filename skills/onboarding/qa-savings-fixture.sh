#!/usr/bin/env bash
# Independent lifecycle fixture runner. It makes no measured-savings claim.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd -- "$script_dir/../.."
exec node --import ./test-env.mjs --test lifecycle-test.mjs lifecycle-version-independent-test.mjs
