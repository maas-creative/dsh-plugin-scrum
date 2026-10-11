# Own concurrent work

Give each goroutine an owner, a cancellation path and a point where the owner waits for termination. Bound the number of workers and queued inputs. Pass contexts into work rather than storing a request context in a long-lived object. A channel close belongs to the producer that knows production has ended.

## Execution

```sh
go test -race ./...
```

## Acceptance

Test cancellation while sending and receiving, failure with siblings still running, and a consumer that stops early. Avoid sleeping to synchronize a test; use explicit events. Race detection can reveal exercised data races but does not prove all schedules safe.

Official API and version reference: [Own concurrent work](https://pkg.go.dev/context). This operational guidance is independently authored for Scrum.
