# CLI command structure

Keep argument parsing separate from work. Use Cobra when the project needs subcommands, persistent flags or generated help; do not introduce it merely to parse one positional value. A command handler should return its error to one top-level reporter. Send machine output to stdout and diagnostics to stderr.

## Execution

```sh
go test ./...
go run ./cmd/example --help
```

## Acceptance

Test missing arguments, mutually exclusive flags, a cancelled context and a real error exit. Avoid printing the same failure in a handler and again in main. Configuration precedence must be documented and tested; environment variables should not unexpectedly override an explicit user flag.

Official API and version reference: [CLI command structure](https://cobra.dev/docs/). This operational guidance is independently authored for Scrum.
