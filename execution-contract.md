# Scrum execution API v1

Export `createExecutionBridge` from `dsh-plugin-scrum/execution`.
Export `createStandaloneRuntime(ctx, {dataDir, intervalMs})` from `dsh-plugin-scrum/standalone`; its returned `runtime.execution` is the same bridge. `runtime.standalone.close()` releases this host's resources. Use one runtime per execution data directory. `apply(ctx)` automatically starts an independent runtime when no external runtime/socket is configured; a host that creates its own runtime passes it as `config.runtime` and must close it.

Dashboard receives `scrumClient` by host injection. No Dashboard import, business DB lookup, package load order, or business ID is part of this API. Dashboard owns associations to business tasks and their revisions. The host must bind `parentSessionId` to the authenticated parent; this in-process API does not authenticate HTTP callers.

Methods:

- `request({prompt,cwd,model?,output,completionCriteria,parentSessionId,role?,dependencies?,instructionId?})`. `execute` is an alias. The first five string fields except model are required. cwd is absolute. Model defaults to GPT 6.1 Sol / low. dependencies are owned execution IDs. Without `instructionId` each call creates a new execution. With `instructionId`, acceptance is idempotent: the same key and the same canonical payload returns the stored receipt and execution (`idempotentReplay:true`), while the same key with different content fails with `409 receipt-conflict`. Acceptance (receipt, task, model selection, queue entry) commits in one transaction; model execution starts later through dispatch.
- `receipt({receiptId|instructionId,parentSessionId})` returns the durable receipt and its execution DTO.
- `get({executionId,parentSessionId})`, `list({parentSessionId})`.
- `stop({executionId,parentSessionId})`, `retry({executionId,parentSessionId})`.
- `review({executionId,parentSessionId,accept,hash,reason})` verifies the currently reported artifact and exact hash. Missing, partial, changed, or unverified output never becomes done. `ready` means reviewed isolated Git output awaits explicit fingerprint integration through `runtime.changes` / `runtime.integrate`.
- `events({parentSessionId,after:0})` retrieves ordered durable events. `after` is a nonnegative safe integer; `eventId` is an increasing SQLite integer, exclusive as a cursor. It persists across runtime restarts. IDs may have gaps because the sequence is shared across parents. The client keeps the largest received ID, polls again, and deduplicates by eventId. This is pull-based subscription, not a callback. Empty results keep the old cursor.

DTO:

```json
{"schemaVersion":1,"executionId":"execution-task-uuid","receiptId":"receipt-uuid","instructionId":"caller-key","payloadHash":"sha256","eventId":12,"parentSessionId":"parent","status":"review","artifacts":[{"path":"/workspace/result.md","hash":"sha256"}],"verification":{"verified":false,"reason":"","evidence":""},"assignments":[]}
```

`receiptId` is durable and stable for the submission; `instructionId` is the caller key (or the receipt ID when the caller omitted one); `payloadHash` is the SHA256 of the canonical payload. `request` also returns `idempotentReplay`.

The canonical payload includes the resolved model and fallbacks, so changing the default worker model changes the hash of a new submission. A replay must send the same resolved model to match; this is intentional because the model is part of what was accepted. The receipt, task, model selection, and queue entry commit in one transaction. The `execution.created` event is appended after that commit, so a crash between commit and event append leaves a durable receipt and task with a missing event; recovery reads the receipt/task, not the event, as the source of truth.

The executionId is `task_create`'s ID. Worker attempts have separate assignment IDs. todo is queued, preparing/running is executing, review is reported but unverified, ready is integration pending, done is independently accepted, cancelled/error/blocked/uncertain retain partial work. A worker report alone cannot complete a business task.

Notification delivery is stored separately from the execution result in `delivery_outbox` with `delivery_attempts` history. A retry re-sends the stored report and never re-runs the worker. Pending rows and expired delivery leases survive a process restart; delivered rows are retained rather than overwritten. A claim only delivers rows this caller actually moved to `delivering`, so a lost race cannot deliver the same report twice. Parent wake is tracked per batch in `parent_wake_receipts` (`pending`→`requested`→`completed`, or `failed`); the durable session-log marker `Scrum wake <batchId>` is the receipt, so a restart that finds the marker completes the wake without waking the parent again.

Events are `execution.created` and `execution.transitioned`, with `{schemaVersion,eventId,type,parentSessionId,executionId,status,artifacts,verification}`. A done transition contains accepted evidence; review and ready are never marked verified. Delivery is repeatable by cursor, not destructive acknowledgement.

One execution declares one output path. For a file, hash is the SHA256 of all bytes. For a directory, hash is the SHA256 of a sorted manifest of relative path/hash/size records, not a particular member's hash. Directory and binary/large text artifacts require full manual inspection and are rejected by bridge auto-accept when `artifact.complete` is false. An authorized host may use the existing explicit human-review `runtime.review(reviews,{human:true})` with `manual:true` only after inspection. Multiple outputs should use separate execution IDs and dependencies, or one explicitly reviewed directory manifest.

Scrum stores only execution tasks, sessions, attempts, verification records, events, and owned Team/DAG/continuation metadata in `execution.sqlite`. No projects, deadlines, or submissions tables are created. Legacy `./ledger` / `./planner` exports remain explicit compatibility modules and are not the standalone store.

### External runtime host delivery

A host supplying `config.runtime` owns the parent connection and must call `runtime.connectParent({deliver, isBusy, requestPlan})` before running work. The callbacks must address the parent session and preserve durable notification identities. Runtime ticks reject pending notifications when `deliver` is missing; persisted rows remain available for recovery after the host connects. Standalone mode provides these callbacks itself.

### Current-source completion evidence

Docker dispatch receipts retain the trusted source snapshot fingerprint and pinned image identity. Overall Goal approval requires an independently reviewed report whose snapshot still matches the approved source inputs and current Worker image. Source edits, new approved source files, an image change, or missing snapshot provenance require a fresh independent verification. A verifier's own report path is excluded from the source fingerprint so publishing its report does not invalidate its evidence. Failed verification reports may still be recorded without approving completion.
