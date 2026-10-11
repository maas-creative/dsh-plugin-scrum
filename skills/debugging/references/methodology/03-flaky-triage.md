# Diagnose intermittent failures

Run the unchanged reproduction repeatedly and record total attempts, failures, timing and environment. Retain the failing seed and schedule when available. A successful retry does not invalidate the failed attempt. Compare serial and concurrent execution, cold and warm caches, restart and resume, and clean versus persisted state when relevant.

Look for missing awaits, shared state, clock assumptions, stale ownership, test isolation and resource exhaustion. Instrument the transitions that establish ordering rather than adding sleeps until the test passes. For crash recovery, interrupt before and after durable writes; verify idempotency and cleanup with the same stable IDs.

After repair, repeat the original failing scenario and exercise its boundary conditions. Report the number of observed attempts and the remaining uncertainty instead of promising that a finite run proves the absence of all races. Reuse the final release build for acceptance.
