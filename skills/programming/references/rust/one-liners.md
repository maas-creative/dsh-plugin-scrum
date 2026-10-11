# Commands as evidence

Run checks from the crate or workspace root and preserve exit status. Formatting changes files, so review its output. A pipeline must not hide a failed producer. Keep actual entry-point checks separate from compilation.

## Acceptance

Confirm tests were collected. A crate with zero tests does not establish behavior. Record toolchain, features and target with the result.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Commands as evidence](https://doc.rust-lang.org/cargo/commands/). This operational guide is independently authored for Scrum.
