# Debug with the correct Python environment

Identify the interpreter, virtual environment, import paths and actual dependency versions. Reproduce with that executable rather than the user's default Python. Inspect exception chains and the first application frame where the contract breaks. For a small synchronous reproduction, the standard pdb module can provide direct runtime evidence.

For a DAP session, verify the installed adapter and its launch or attach instructions before starting it. Capture the adapter response and the resulting stack, scope and variable references. A successful import of debugpy or another adapter is not a successful connection. References may become invalid after execution resumes.

Avoid changing global packages to debug one project. Keep input fixtures and environment changes owned and reversible. Re-run the repaired operation without the debugger, then test persistence, subprocesses or concurrency when implicated by the failure.
