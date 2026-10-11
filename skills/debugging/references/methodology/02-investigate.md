# Link observations to competing explanations

Trace the real caller, input transformation, state write, asynchronous boundary and final output. Locate where expected and observed behavior first diverge. Read connected code and tests; a suspicious line without a reachable failing case is not a finding. Distinguish a logged intention from an accepted request, actual execution, persisted receipt and verified result.

Write at least two plausible explanations when evidence is ambiguous. For each, choose an observation that would distinguish it from alternatives. Change one relevant condition at a time. Preserve negative results and the exact build used. Inspect process state, protocol responses, persistence and UI separately when one surface could conceal another's failure.

Prefer deterministic assertions over arbitrary delays. Correlate requests and responses using stable IDs. Do not infer an internal model decision from an execution trace; explain only the causal relationships the trace establishes. Continue with available alternative measurements when a preferred tool is unavailable.
