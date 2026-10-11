$ErrorActionPreference = "Stop"
$entry = Join-Path $PSScriptRoot "../../../independent/data-environment-cli.mjs"
& node $entry setup-uv @args
exit $LASTEXITCODE
