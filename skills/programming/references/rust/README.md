# Rust implementation guide

Respect the existing edition, minimum supported Rust version, toolchain and crate layout. Model recoverable failure explicitly and keep resource ownership visible. The included generator refuses an existing destination and produces a starter crate; building it does not validate a requested feature.

## Topics

- [Design a safe public API](api-design.md)
- [Async work with Tokio](async-tokio.md)
- [HTTP boundaries with Axum](axum-stack.md)
- [Maintain compiler and dependency gates](cargo-strict.md)
- [Typed CLI arguments](clap-stack.md)
- [Shared state and termination](concurrency.md)
- [Dependencies that serve the contract](libraries.md)
- [Macros with inspectable behavior](macros.md)
- [Commands as evidence](one-liners.md)
- [Properties and reviewed snapshots](proptest-insta.md)
- [Represent permitted transitions](type-state.md)
- [An unsafe block needs an argument](unsafe-discipline.md)
- [Measure costs without removing checks blindly](zero-cost-safety.md)
- [Memory safety review](../rust-ub/README.md)

Exercise the real public entry point, malformed inputs and cleanup. Source-policy diagnostics supplement compiler and behavior checks. Consult the [Rust book](https://doc.rust-lang.org/book/) for the installed language version.
