# Review three explanations before committing to a repair

Review the evidence from three perspectives: the runtime path that produced the failure, the design contract that should hold, and an alternative explanation that would make the proposed fix ineffective. These are review perspectives; they do not require three agents or three models. With delegation prohibited, perform the reviews yourself.

For each perspective record the concrete failing case, supporting observations, contrary observations and a discriminating test. Resolve disagreement using measurements, not majority voting. An external Oracle review is optional only when authorized and configured within the user's model restrictions. Send a sanitized, bounded bundle and verify its recommendations against the actual code.

A review result is not implementation. Convert accepted findings into repairs and acceptance tests. If evidence remains partial, keep the hypothesis qualified and continue investigating rather than declaring the whole task complete.
