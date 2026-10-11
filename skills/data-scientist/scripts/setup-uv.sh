#!/bin/sh
set -eu
script_root=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec node "$script_root/../../../independent/data-environment-cli.mjs" setup-uv "$@"
