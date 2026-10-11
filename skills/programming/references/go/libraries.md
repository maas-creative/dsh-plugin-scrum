# Choose dependencies deliberately

Start with standard packages: net/http for transport, encoding/json for JSON, context for cancellation, errors for failure classification, log/slog for structured events and testing for verification. Add a library only when a concrete need outweighs maintenance and distribution cost. Pin versions through the module files.

## Execution

```sh
go list -m all
go mod verify
go test ./...
```

## Acceptance

Check direct and transitive licenses before distribution. A dependency update must be exercised at its real boundary. Do not mistake module checksum verification for a security audit or functional compatibility proof.

Official API and version reference: [Choose dependencies deliberately](https://go.dev/doc/modules/managing-dependencies). This operational guidance is independently authored for Scrum.
