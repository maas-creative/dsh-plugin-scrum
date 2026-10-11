# Measure costs without removing checks blindly

Use ownership, borrowing and static dispatch to express safety clearly. Do not remove validation, introduce unsafe conversion or force inlining based on an unmeasured performance assumption. Benchmark the actual bottleneck with representative inputs.

## Acceptance

Compare correctness and resource use before and after optimization. Record target and build profile. A faster synthetic microbenchmark may not improve the real request path.

Run applicable project checks:

```sh
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-targets --all-features
cargo test --doc
```

Use supported feature combinations for the project; all-features is inappropriate for mutually exclusive features. Preserve actual failures rather than editing assertions just to obtain a green result. Version reference: [Measure costs without removing checks blindly](https://doc.rust-lang.org/book/). This operational guide is independently authored for Scrum.
