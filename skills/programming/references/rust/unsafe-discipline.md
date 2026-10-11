# An unsafe block needs an argument

State allocation, lifetime, alignment, initialization and aliasing invariants beside the operation. Keep the safe wrapper responsible for rejecting invalid callers. Prefer an established safe abstraction when possible. A SAFETY comment is a claim to review, not a proof.

## Acceptance

Follow the Rust memory-safety guide and run relevant diagnostic tools. Test partial initialization, panic cleanup and malformed inputs at the safe interface.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [An unsafe block needs an argument](https://doc.rust-lang.org/nomicon/). This operational guide is independently authored for Scrum.
