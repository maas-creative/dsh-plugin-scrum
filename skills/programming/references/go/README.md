# Go implementation guide

Use the project's existing Go version and module layout. The included scaffold and source-policy helpers are starting tools, not evidence that a feature is complete. Trace the actual input, persistent changes and user-visible output.

## Topics

- [Create a Go project](bootstrap.md)
- [HTTP service boundaries](backend-stack.md)
- [Terminal UI with Bubble Tea](bubbletea-v2.md)
- [CLI command structure](cobra-stack.md)
- [Own concurrent work](concurrency.md)
- [Model domain records](data-modeling.md)
- [Make failures actionable](error-handling.md)
- [Static analysis without blanket suppression](golangci-strict.md)
- [Typed RPC boundaries](grpc-connect.md)
- [Choose dependencies deliberately](libraries.md)
- [Commands that produce useful evidence](one-liners.md)
- [SQL ownership and generated access](sqlc-pgx.md)
- [Test behavior at the right boundary](testing.md)
- [Types should express a contract](type-patterns.md)

Run formatting, relevant tests, vet and build from the module root. Exercise cancellation and shutdown for owned services. Preserve records during migrations and report only checks actually executed. The standard library API is authoritative for the installed Go release: [Go documentation](https://go.dev/doc/).
