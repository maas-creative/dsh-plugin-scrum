# Failures that reach the owner

Throw Error objects for unexpected runtime failures and use an explicit result type when a caller must handle a normal domain rejection. Catch at the boundary that can recover or report. Preserve the cause and cancellation state; do not turn an exception into an empty success list.

## Execution

```sh
bun test
```

Run commands from the appropriate project or skill directory and use the existing package manager when it differs.

## Acceptance

Test the real failure path, caller-visible state and preserved records. Bound retries and verify that repeated calls do not duplicate side effects. An empty catch or a logged error is not recovery unless the required state transition actually occurs.

Official API reference: [Failures that reach the owner](https://www.typescriptlang.org/docs/handbook/2/narrowing.html). The operational guidance is independently authored for Scrum.
