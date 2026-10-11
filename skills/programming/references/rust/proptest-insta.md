# Properties and reviewed snapshots

Use a property test for an invariant over a meaningful input domain, such as round-trip preservation or parser rejection. Bound generated work. Use snapshots for stable external output and review updates as behavior changes, not automatic fixes.

## Acceptance

Keep a failing seed or minimized counterexample. Avoid properties that merely restate the implementation. A snapshot does not prove that its output is semantically correct.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Properties and reviewed snapshots](https://proptest-rs.github.io/proptest/). This operational guide is independently authored for Scrum.
