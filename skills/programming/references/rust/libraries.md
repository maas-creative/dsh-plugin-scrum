# Dependencies that serve the contract

Start with standard ownership, collections, I/O and error types. Add crates for concrete capabilities and inspect version, features, transitive dependencies and distribution licenses. Keep Cargo.lock policy aligned with the project type.

## Acceptance

Exercise the real boundary after an update and review generated lock changes. A checksum or compilation success is not a security or behavioral audit.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Dependencies that serve the contract](https://doc.rust-lang.org/cargo/). This operational guide is independently authored for Scrum.
