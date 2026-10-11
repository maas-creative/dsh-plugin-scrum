---
name: onboarding
description: Explain the current independent Scrum installation and available workflow.
---

# Introduce the current Scrum installation

Greet the user briefly, then explain the available workflow using the actual installation state. The user's current task takes precedence over onboarding. Use GPT 6.1 Sol with low reasoning. Do not delegate or change permissions without authorization. Do not delay a concrete task with a compulsory setup questionnaire.

Use the read-only `scrum_lifecycle_status` tool (or inspect the user-interface `/scrum-lifecycle` command output) to inspect version, configuration diagnostics, configured providers, model-cache availability, update state, and the first-run marker. The marker indicates that the host scheduled first-run guidance; it does not prove authentication, successful model execution, or completed setup. Explain any observed failure precisely and do not manufacture a healthy status.

Scrum is an independent DSH plugin for execution, delegation, result collection, verification, and continuation. Dashboard is a separate product and plugin for project records and its UI. Either can be used alone or together. Do not require a Dashboard project ledger when Scrum is used alone, and do not move project ownership into Scrum.

Explain HardTackle and its hdt entry using the commands actually registered by the current host. Activation does not itself prove that multiple workers ran. Delegation requires authorized tasks, explicit output and acceptance criteria, suitable configured roles, and report collection. Preserve the configured model restrictions. An explicit stop must stop continuation; resuming requires authorization.

Show how to inspect an agent's role, model, execution state, waiting reason, reports, and artifacts using the current host UI and tools. Distinguish reported success from inspected output and complete delivery. If a UI element or tool is unavailable, say which operation is available rather than inventing a button.

Offer /scrum-init-deep status for repository-instruction coverage. Explain run, skip, never-project, and never-global without selecting them for the user. Repository refresh should preserve existing AGENTS.md constraints and verify actual files before snapshotting. /scrum-onboard redisplays this guidance, subject to the host's per-session redisplay guard.

For updates, /scrum-update check inspects availability and /scrum-update stage prepares a verified release for a later process start when permitted. Staging is not activation; pinned versions and failed verification must remain visible. Authentication and OS/browser grants require the actual provider or operating-system flow and must not be inferred from a saved setting.

Finish with the concrete current state and the next step needed for the user's task. Do not claim measured savings, successful QA, working OAuth, or integration merely because an example fixture exists. Verify such claims against actual evidence.

`/scrum-lifecycle` is a host interface command, not a shell executable. Do not run it through bash. Prefer the native read-only tool when explaining installation state from a model session.
