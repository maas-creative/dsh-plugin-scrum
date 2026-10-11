# Async work with Tokio

Use the installed runtime version. Own spawned tasks, bound queues and propagate stop requests. Keep blocking work off executor threads and do not hold a synchronous lock across await. A task handle is not a validated artifact.

## Acceptance

Test cancellation during I/O, a failed sibling and graceful shutdown. Confirm all owned tasks end; detached task creation must be deliberate.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Async work with Tokio](https://tokio.rs/tokio/tutorial). This operational guide is independently authored for Scrum.
