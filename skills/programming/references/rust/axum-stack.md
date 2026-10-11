# HTTP boundaries with Axum

Consult the installed Axum release for router and extractor APIs. Keep request decoding, domain work and persistence separate. Validate size, ownership and state immediately before mutation. Map internal failures into intentional public responses.

## Acceptance

Test a real router with malformed input, missing authorization, a successful mutation and its readback. Verify startup and shutdown cleanup.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [HTTP boundaries with Axum](https://docs.rs/axum/). This operational guide is independently authored for Scrum.
