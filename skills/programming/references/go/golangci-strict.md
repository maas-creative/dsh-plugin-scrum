# Static analysis without blanket suppression

Use a configuration matching the installed golangci-lint major version. Enable checks the project can maintain and record the tool version in CI. Fix an underlying problem before using a suppression. A narrow suppression needs a reason and a test for the invariant that makes it safe.

## Execution

```sh
golangci-lint version
golangci-lint run
go vet ./...
```

## Acceptance

Run the included Go source-policy check on changed paths. It supplements static analysis and currently diagnoses unreasoned nolint comments, ownerless TODO/FIXME and the compact interface{} spelling. A successful policy check is not a compiler or typecheck result.

Official API and version reference: [Static analysis without blanket suppression](https://golangci-lint.run/docs/). This operational guidance is independently authored for Scrum.
