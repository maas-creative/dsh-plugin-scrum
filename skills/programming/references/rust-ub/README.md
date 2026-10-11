# Review Rust memory safety

Begin with the safe interface exposed to callers. Identify any unsafe operation behind it and state the invariant that every caller must satisfy. The compiler accepts an unsafe block without proving those invariants; successful compilation is therefore insufficient acceptance evidence.

Use [the failure taxonomy](ub-taxonomy.md) to examine ownership, initialization, aliasing and concurrency. Select [diagnostic tools](miri-sanitizers-loom.md) for the code path involved. Keep the unsafe surface small and prefer a standard-library or maintained safe abstraction when it satisfies the contract.

Record the tested target, toolchain, inputs and exercised path. A successful diagnostic run only supports the executions it explored. Do not promote it into a proof that arbitrary input or every thread schedule is safe. Test the safe wrapper's malformed inputs, cleanup and panic behavior as well as its ordinary result.

Official semantics: [Rust Reference](https://doc.rust-lang.org/reference/behavior-considered-undefined.html). Practical background: [Rustonomicon](https://doc.rust-lang.org/nomicon/). This guide is independently authored for Scrum.
