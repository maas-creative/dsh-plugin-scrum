---
name: handoff
description: Prepare an evidence-based handoff that another session can execute without guessing.
---

# Work handoff

SESSION READ FIRST: inspect the authoritative current session and its artifacts before drafting the handoff. Do not reconstruct history from memory alone.

USER REQUESTS (AS-IS): preserve the relevant user requests verbatim and distinguish them from your interpretation. EXPLICIT CONSTRAINTS: record the user and repository restrictions separately, including model and delegation limits.

Maximum 10 files in the key-file index: choose the most important entry points and link larger inventories as separate artifacts. This limit applies to the concise index, not the evidence that must be retained.

DO NOT attempt to programmatically create new sessions as part of preparing a handoff. Session creation requires its own user authorization; deliver the context to the existing authorized recipient.

Identify the receiving role and the user's objective. Record the current workspace and revision, relevant files, constraints, decisions and acceptance conditions. Include exact task and session identifiers when available.

Separate completed and verified work from edits awaiting validation, live processes, failed checks and unresolved questions. Link artifacts and test logs. Record the commands, environment and results needed to reproduce the checks without including secrets.

For a live process, record its actual handle and last observed status. For pending changes, describe their ownership and dependencies. Preserve user data and concurrent edits. State the next executable action and what evidence will establish completion.

Send the handoff only through an authorized communication route. Confirm delivery using the route's actual receipt; preparing a document or accepting a send request is not acknowledgment by the recipient. Preserve the handoff if delivery fails and report the specific failure.

User authorization takes precedence over this workflow. Preserve the configured model; in this project use GPT 6.1 Sol with low reasoning. Do not create subagents when delegation is prohibited.
