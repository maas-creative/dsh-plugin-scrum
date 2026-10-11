# Create a Go project

Use the existing module when one exists. For a new project, select a module path owned by the publisher and run the included generator from the skill directory. Its destination must not already exist. The generated HTTP service binds to loopback by default; changing its listener is a deployment decision. Inspect go.mod and the generated configuration before resolving dependencies.

## Execution

```sh
python3 scripts/go/new-project.py example --path /path/to/parent --module example.com/example
cd /path/to/parent/example
go mod tidy
go fmt ./...
go test -race ./...
go vet ./...
go build ./...
```

## Acceptance

Generation is not acceptance. Start the binary on an unused owned port, request /health, stop it and confirm the process exits. A dependency or compiler failure must remain visible. Keep generated files in the project and do not rerun the generator over working code.

Official API and version reference: [Create a Go project](https://go.dev/doc/modules/). This operational guidance is independently authored for Scrum.
