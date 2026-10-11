# Test behavior at the right boundary

Use table-driven cases when several inputs exercise the same contract. Verify an observable result rather than an internal helper sequence. Use temporary directories and owned ports; clean resources even when an assertion fails. Keep deterministic clocks or explicit events for time-dependent behavior.

## Execution

```sh
go test ./...
go test -race ./...
```

## Acceptance

A persistence change needs a reload or restart check. A concurrency change needs cancellation and failure cases. An HTTP change should run the real handler through httptest or an owned listener. Fuzz parsing boundaries with bounded inputs when malformed input is central to the risk.

Official API and version reference: [Test behavior at the right boundary](https://pkg.go.dev/testing). This operational guidance is independently authored for Scrum.
