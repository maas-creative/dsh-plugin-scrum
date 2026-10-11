# Shared state and termination

Send and Sync describe cross-thread contracts; an unsafe implementation requires a field-by-field invariant. Prefer message ownership or a clearly bounded critical section. Document lock ordering and who closes each producer or consumer.

## Acceptance

Test early consumer exit, producer failure and shutdown. Use schedule modeling when needed; ordinary tests exercise only their actual schedules.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Shared state and termination](https://doc.rust-lang.org/book/ch16-00-concurrency.html). This operational guide is independently authored for Scrum.
