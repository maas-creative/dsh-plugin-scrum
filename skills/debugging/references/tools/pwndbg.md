# Inspect native state with an available debugger extension

Pwndbg is a debugger extension, not a substitute for confirming the underlying debugger, architecture and symbols. Inspect the installed release and help before choosing extension commands. Use an owned program or an authorized attachment and verify that the selected process is the intended target.

Inspect the stack, registers, memory mappings and relevant data structures around the failing instruction. Preserve raw addresses and executable identity so observations can be correlated later. Missing symbols or optimized-out variables limit conclusions; they do not prove application state.

This guide concerns diagnosis and repair. Do not extend scope to exploitation or unrelated targets. Dispose the debugger connection and keep the evidence needed to reproduce the defect. Re-run the repaired final executable without instrumentation.
