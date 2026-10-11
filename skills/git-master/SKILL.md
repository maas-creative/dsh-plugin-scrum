---
name: git-master
description: Inspect, organize and verify Git changes while preserving the user's work and authorized history.
---

# Deliver reviewable Git changes

Start by identifying the repository, current branch, worktree, upstream and dirty state. Read repository instructions and the user's requested outcome. Use GPT 6.1 Sol with low reasoning; do not create agents unless authorized. Preserve unrelated changes, existing operations and project records. A Git action is part of delivering the task, not a substitute for completing it.

Inspect status, staged and unstaged changes, recent history and relevant callers. Prefer machine-readable status with NUL-delimited paths when scripting so spaces, tabs and newlines do not change file identities. Record the target revision when comparing builds or review results. Detect an existing merge, rebase, cherry-pick or bisect before starting another operation; do not abort the user's operation as cleanup.

Organize commits around a coherent behavior change and its verification. Do not stage all files blindly in a shared workspace. Review the staged diff before committing, including generated files, preferred source, notices and possible secrets. Use a body file for multiline descriptions and literal arguments rather than shell interpolation of user text. If a test failed, retain the failure and resolve it before claiming the commit is validated.

To investigate history, trace the affected path and symbol, inspect relevant commits and compare a known working revision. Renames, generated output, merge commits and uncommitted changes can complicate attribution; distinguish those cases rather than inventing an author or cause. Use an owned disposable worktree for bisecting when it would otherwise disturb the current checkout. Stop and restore the owned investigation state after the result.

Rewrite history only within the user's authorization and the known sharing state. An amend, squash or rebase is not merely a cosmetic change when others depend on existing commits. Never use a hard reset or force push as an automatic recovery from uncertainty. When rebasing or merging authorized work, preserve both intended changes, inspect conflicts in context and run relevant tests after resolving them. A clean index alone does not prove that a merge operation is complete.

For a pull request, describe the concrete problem, resulting behavior and verification. Resolve the exact current head and base; evidence for a previous head does not validate a new one. Follow the repository template and attach the created PR through the host's artifact integration when available. Publishing, merging and shipping remain separate operations with their own authorized scope and delivery gates. Do not merge merely because a PR exists.

Before completion, inspect the final diff, tests, commit identity, branch state and owned cleanup. Verify the delivered artifact and any persisted changes. Report the result and material limitations without equating a commit, staged package or pushed branch with completion of the whole user request.
