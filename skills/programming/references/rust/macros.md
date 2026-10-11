# Macros with inspectable behavior

Use functions or generics when they express the operation clearly. Introduce a macro for syntax generation or repeated structural work that ordinary code cannot express cleanly. Preserve useful source locations and avoid surprising evaluation count or ownership changes.

## Acceptance

Test generated behavior, invalid use and interactions with caller names. Inspect expansion when a diagnostic is confusing. Do not hide unsafe operations behind a seemingly safe invocation.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Macros with inspectable behavior](https://doc.rust-lang.org/reference/macros.html). This operational guide is independently authored for Scrum.
