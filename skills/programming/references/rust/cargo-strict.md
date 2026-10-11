# Maintain compiler and dependency gates

Keep edition, toolchain and features explicit. Run formatting, Clippy and tests for the targets actually shipped. Use cargo-deny when configured for dependency policy, but do not infer licensing from a successful build. Suppression needs a narrow invariant and an explanation.

## Acceptance

Record the installed tools and inspect nonzero exits. A missing optional audit tool is an unexecuted audit, not a pass.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Maintain compiler and dependency gates](https://doc.rust-lang.org/cargo/). This operational guide is independently authored for Scrum.
