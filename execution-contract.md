# Scrum execution API v1

Export `createExecutionBridge` from `dsh-plugin-scrum/execution`.
Export `createStandaloneRuntime(ctx, {dataDir, intervalMs})` from `dsh-plugin-scrum/standalone`; its returned `runtime.execution` is the same bridge. `runtime.standalone.close()` releases this host's resources. Use one runtime per execution data directory. `apply(ctx)` automatically starts an independent runtime when no external runtime/socket is configured; a host that creates its own runtime passes it as `config.runtime` and must close it.

Dashboard receives `scrumClient` by host injection. No Dashboard import, business DB lookup, package load order, or business ID is part of this API. Dashboard owns associations to business tasks and their revisions. The host must bind `parentSessionId` to the authenticated parent; this in-process API does not authenticate HTTP callers.

Methods:

- `request({prompt,cwd,model?,output,completionCriteria,parentSessionId,role?,dependencies?})`. `execute` is an alias. The first five string fields except model are required. cwd is absolute. Model defaults to GPT 6.1 Sol / low. dependencies are owned execution IDs. Each call creates a new execution.
- `get({executionId,parentSessionId})`, `list({parentSessionId})`.
- `stop({executionId,parentSessionId})`, `retry({executionId,parentSessionId})`.
- `review({executionId,parentSessionId,accept,hash,reason})` verifies the currently reported artifact and exact hash. Missing, partial, changed, or unverified output never becomes done. `ready` means reviewed isolated Git output awaits explicit fingerprint integration through `runtime.changes` / `runtime.integrate`.
- `events({parentSessionId,after:0})` retrieves ordered durable events. `after` is a nonnegative safe integer; `eventId` is an increasing SQLite integer, exclusive as a cursor. It persists across runtime restarts. IDs may have gaps because the sequence is shared across parents. The client keeps the largest received ID, polls again, and deduplicates by eventId. This is pull-based subscription, not a callback. Empty results keep the old cursor.

DTO:

```json
{"schemaVersion":1,"executionId":"execution-task-uuid","eventId":12,"parentSessionId":"parent","status":"review","artifacts":[{"path":"/workspace/result.md","hash":"sha256"}],"verification":{"verified":false,"reason":"","evidence":""},"assignments":[]}
```

The executionId is `task_create`'s ID. Worker attempts have separate assignment IDs. todo is queued, preparing/running is executing, review is reported but unverified, ready is integration pending, done is independently accepted, cancelled/error/blocked/uncertain retain partial work. A worker report alone cannot complete a business task.

Events are `execution.created` and `execution.transitioned`, with `{schemaVersion,eventId,type,parentSessionId,executionId,status,artifacts,verification}`. A done transition contains accepted evidence; review and ready are never marked verified. Delivery is repeatable by cursor, not destructive acknowledgement.

One execution declares one output path. For a file, hash is the SHA256 of all bytes. For a directory, hash is the SHA256 of a sorted manifest of relative path/hash/size records, not a particular member's hash. Directory and binary/large text artifacts require full manual inspection and are rejected by bridge auto-accept when `artifact.complete` is false. An authorized host may use the existing explicit human-review `runtime.review(reviews,{human:true})` with `manual:true` only after inspection. Multiple outputs should use separate execution IDs and dependencies, or one explicitly reviewed directory manifest.

Scrum stores only execution tasks, sessions, attempts, verification records, events, and owned Team/DAG/continuation metadata in `execution.sqlite`. No projects, deadlines, or submissions tables are created. Legacy `./ledger` / `./planner` exports remain explicit compatibility modules and are not the standalone store.
