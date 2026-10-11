# Debug the exact Rust executable

Capture rustc and Cargo versions, target triple, profile, feature flags, lock file and executable revision. Determine whether the failure is a panic, ownership-independent logic error, FFI problem or native memory fault. Preserve the panic backtrace and its environment rather than relying on a paraphrased error.

Use an available LLDB, GDB or compatible DAP adapter after verifying architecture and symbol support. Debug information and optimization influence what variables can be observed; an unavailable value is not evidence that it was absent at runtime. Inspect unsafe and FFI boundaries with their actual callers and ownership contracts.

Reproduce the fix with the user's normal build profile and features. Keep temporary artifacts owned and avoid replacing the user's toolchain globally. Record any discrepancy between debug and release behavior as a separate acceptance question.
