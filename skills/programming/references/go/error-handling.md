# Make failures actionable

Return an error for recoverable failure and add operation context while preserving the underlying cause. Use errors.Is or errors.As when a caller needs to classify a wrapped error. Keep cancellation distinct from an application failure. Log once at the boundary that can decide what happens next.

## Execution

```sh
go test ./...
```

## Acceptance

Test classification after wrapping and confirm an error is not converted to a zero-value success. A retry requires a bounded policy and safe side effects. Panic recovery must not silently mark a mutation committed; preserve enough state for the caller to know whether it ran.

Official API and version reference: [Make failures actionable](https://pkg.go.dev/errors). This operational guidance is independently authored for Scrum.
