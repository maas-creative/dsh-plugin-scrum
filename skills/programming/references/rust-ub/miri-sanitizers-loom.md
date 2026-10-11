# Diagnostics for memory and scheduling failures

Choose tools according to the suspected boundary, not as a ceremonial checklist. Ordinary compiler checks and tests remain necessary. Pin diagnostic toolchain versions separately when they require nightly features.

## Miri

Miri interprets supported Rust executions and can diagnose classes of undefined behavior in exercised code. Use the documented installation and invocation for the chosen toolchain. A common project test entry point is:

```sh
cargo +nightly miri test
```

Confirm that the affected test actually ran. Unsupported operations or platform limitations must remain visible; do not mark a skipped path as passed. Record the test and toolchain. See the [official Miri repository](https://github.com/rust-lang/miri) for current capabilities.

## Sanitizers

A sanitizer run requires an appropriate compiler configuration and target. Test the native or FFI boundary under the supported sanitizer, preserve the diagnostic and reproduce a failure before fixing it. Instrumentation is specific to the build; do not cite an ordinary release test as sanitizer evidence. Check the [Rust unstable-book sanitizer documentation](https://doc.rust-lang.org/unstable-book/compiler-flags/sanitizer.html) before configuring flags.

## Loom and concurrency

Use Loom for a small model of synchronization when schedule exploration is relevant. The model must use Loom's synchronization primitives and preserve the algorithm's important states. Reducing a model so far that it removes the failure path makes a green result misleading. Consult the [Loom project](https://github.com/tokio-rs/loom) for its supported modeling interface.

## Completion

Keep proof obligations separate from tool results. A successful explored execution does not establish every input, platform or schedule. Review the unsafe invariant, safe caller contract and cleanup path alongside the diagnostics. This operational policy is independently authored for Scrum.
