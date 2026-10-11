# Design a safe public API

Expose the invariant through constructors and methods instead of public mutable fields. Use Result for recoverable failure and distinguish absence with Option. Keep ownership and borrowing visible in signatures. Avoid forcing callers to clone simply because the implementation has unclear lifetimes.

## Acceptance

Test invalid construction, boundary values and cleanup after a failed operation. Review serialized compatibility before changing a public type.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Design a safe public API](https://doc.rust-lang.org/book/). This operational guide is independently authored for Scrum.
