---
name: dag-library
description: Define and execute dependency graphs with explicit outputs, ownership and verified completion.
---

# Manage a dependency graph without losing the overall outcome

Begin with the requested final result and acceptance criteria. Represent an independently verifiable output as a node, and an actual prerequisite as a dependency. Keep project records in Dashboard when it is present; Scrum owns execution state and can run without that product. Use GPT 6.1 Sol with low reasoning and respect the user's delegation restrictions.

Inspect the registered DAG tool or the independent dag-store, dag-engine and dag-compiler APIs before choosing operations. Do not invent operation names. Validate unique node IDs, referenced dependencies, cycles, output criteria and ownership before executing. A task with an unresolved predecessor is not ready merely because a worker is available.

Claim ready work using the host's lease and token contract. Keep the lease alive during execution, checkpoint resumable progress and reject stale owners. A retry must retain identity and attempt history without duplicating artifacts or progress writes. A checkpoint is not a successful result. Inspect failed and orphaned executions after restart and reconcile them against actual durable state.

Collect the output, verify its acceptance and complete the canonical execution task before declaring its DAG node complete. Preserve failure reasons and retry limits. When changing the graph, use its current version and do not silently remove a running node. Keep events replayable and expose stream overflow rather than discarding it invisibly.

Join all required outputs and verify the final result. Completed leaves do not establish aggregate completion if integration, review, delivery or cleanup remains. Respect an explicit stop and require authorized resumption. Close owned workers, subscriptions and resources without touching another parent's graph.
