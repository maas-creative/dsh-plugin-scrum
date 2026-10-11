---
name: mass-ulw
description: Coordinate a large verified workflow using authorized workers and bounded execution resources.
argument-hint: "<task>"
---

# Coordinate a large HardTackle workflow

Treat the supplied task as an outcome to deliver, not a request for many workers. Use the planning guidance in [planning](references/planning.md). Preserve the user's model, budget, delegation and stop restrictions. GPT 6.1 Sol with low reasoning is the default required model. If delegation is prohibited, perform the same workflow sequentially yourself.

Inspect the existing task graph, active assignments, checkpoints and reports before creating more work. Register explicit output and acceptance criteria, then dispatch only dependency-ready work with clear file or module ownership. Workers in a shared checkout must preserve others' changes. Use isolated workspaces when concurrent writes would interfere, and retain provenance of the verified build.

Keep resource limits separate from arbitrary task-count limits. Do not cap the plan at a fixed number of suggestions. Bound active processes, connections and model budgets according to actual capacity; queue remaining ready work. An activated mode or accepted dispatch does not prove execution. Inspect roles, models, live state, waiting reasons, failures and artifacts.

Receive results through the host's verified collection path. Correlate stable report IDs and execution tokens, persist receipts and reject stale or duplicate progress updates. A worker report is a claim to inspect. Retry or reassign failed work while preserving attempt history and ownership; do not fabricate completion to release a queue slot.

Integrate outputs, run acceptance on the combined build and satisfy delivery gates. Continue until the user's whole outcome is verified or a concrete external blocker remains after available alternatives. Stop owned workers, watchers and temporary environments at the end. A partial result, idle parent or completed child does not justify aggregate completion.
