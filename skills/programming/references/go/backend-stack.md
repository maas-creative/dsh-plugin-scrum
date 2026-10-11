# HTTP service boundaries

Prefer the standard net/http service when routing and middleware needs are modest. Separate transport decoding from domain operations and persistence. Validate method, content type, request size and required fields before writing data. Carry the request context into database and downstream calls. Configure server timeouts deliberately and use a bounded shutdown context.

## Execution

```sh
go test -race ./...
go vet ./...
go build ./...
```

## Acceptance

Test a malformed request, cancellation, duplicate mutation and shutdown with a live handler. Return a stable public error while keeping detailed diagnostics restricted. Do not expose internal database messages or reflect untrusted input into headers.

Official API and version reference: [HTTP service boundaries](https://pkg.go.dev/net/http). This operational guidance is independently authored for Scrum.
