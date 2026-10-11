# Represent permitted transitions

Use distinct types for stages when compile-time sequencing makes misuse impossible without complicating real callers. Keep runtime validation for untrusted persisted state. Do not model every incidental UI state as a new generic parameter.

## Acceptance

Test constructors and permitted transitions; add compile-fail tests only for an important public guarantee. Verify old persisted states can still load.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Represent permitted transitions](https://doc.rust-lang.org/book/ch10-00-generics.html). This operational guide is independently authored for Scrum.
