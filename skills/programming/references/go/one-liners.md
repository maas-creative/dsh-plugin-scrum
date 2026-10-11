# Commands that produce useful evidence

Run commands from the module root and preserve their exit status. Inspect output before reporting a check as passed. Shell pipelines can hide a failed producer unless pipe failure is handled. Prefer explicit commands over a condensed script whose failure semantics are unclear.

## Execution

```sh
go fmt ./...
go test -race ./...
go vet ./...
go build ./...
go list -m all
```

## Acceptance

Formatting changes files; review those changes. Tests with no test files do not establish behavior coverage. A successful build does not demonstrate shutdown, migrations or HTTP responses. Add a relevant real-entry-point check when the change requires one.

Official API and version reference: [Commands that produce useful evidence](https://pkg.go.dev/cmd/go). This operational guidance is independently authored for Scrum.
