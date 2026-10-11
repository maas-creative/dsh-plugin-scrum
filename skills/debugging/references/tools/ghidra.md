# Use static analysis to form testable hypotheses

Confirm Ghidra availability, version and support for the binary's architecture. Work with an owned copy and preserve the original binary hash. Identify imports, symbols, strings and control-flow regions relevant to the observed failure rather than treating a decompiled listing as equivalent to preferred source.

Decompiler output can contain inferred types, missing names and misleading reconstruction. Cross-check important claims against disassembly, symbols and runtime evidence. Do not copy third-party implementation into an independent replacement merely because a decompiler exposes it.

Keep analysis projects and generated files separate from distributable source. Record the specific address or symbol and its relationship to the failing input. Verify a proposed repair in the actual runtime; static plausibility does not prove that the suspected path executed.
