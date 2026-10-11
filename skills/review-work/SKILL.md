---
name: review-work
description: Review actual artifacts and execution evidence against the full requested outcome.
---

# Verify completed work

Read the request and derive the acceptance conditions. Inspect the current artifacts, their callers and any stored state involved. Check what each test actually proves; green checks do not establish requirements outside their scope.

Trace inputs, permissions, state changes, outputs and cleanup. Look for a reproducible incorrect result, unsafe side effect, data loss, concurrency failure or missing check around a concrete risk. Distinguish a worker's report from independently verified evidence.

For each finding, name the file or artifact, triggering situation, observed consequence and smallest complete correction. Separate release-blocking defects from optional improvements. Do not present speculation or style preferences as defects.

Retest the corrected path and relevant regressions. State which acceptance conditions are verified and which remain incomplete. A partial artifact, worker exit or acknowledged notification does not establish completion of the parent request.

User authorization takes precedence over this workflow. Preserve the configured model; in this project use GPT 6.1 Sol with low reasoning. Do not create subagents when delegation is prohibited.
