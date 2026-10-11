# Typed RPC boundaries

Use generated request and response types from a versioned protocol definition. Keep generation reproducible and review protocol compatibility before changing fields. Connect provides Go handlers and clients for supported RPC protocols; use the installed release documentation for interceptor and transport APIs. Map domain failures into intentional RPC error categories.

## Execution

```sh
go test ./...
go build ./...
```

## Acceptance

Test serialization, authentication failure, deadline expiry, cancellation and a client/server call through the real transport. For streaming, bound buffering and close owned streams on cancellation. Never assume the generated client itself supplies authorization.

Official API and version reference: [Typed RPC boundaries](https://connectrpc.com/docs/go/getting-started/). This operational guidance is independently authored for Scrum.
