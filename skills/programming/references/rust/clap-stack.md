# Typed CLI arguments

Use the installed Clap release and derive support when it fits the project. Separate parsing from work. Keep machine output on stdout and errors on stderr. Return one failure to a top-level reporter rather than printing it repeatedly.

## Acceptance

Test help, invalid values, mutually exclusive options, cancellation and a nonzero execution exit. Validate output paths before destructive writes.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Typed CLI arguments](https://docs.rs/clap/). This operational guide is independently authored for Scrum.
