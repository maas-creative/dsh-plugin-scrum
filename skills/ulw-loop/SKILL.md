---
name: ulw-loop
description: Maintain evidence-backed goals through execution and recovery.
---

# Continue until the requested goals are verified

The user's latest instruction takes precedence. Use GPT 6.1 Sol with low reasoning. Do not delegate without explicit permission. Respect explicit stopping and configured budgets. This workflow does not grant extra permissions or authorize publication.

Read references/define-goal.md to define acceptance criteria and references/full-workflow.md for the execution and recovery sequence. Inspect the existing saved plan before creating one. Use the host-provided HardTackle goal toolkit rather than editing goals.json or ledger.jsonl directly. The host owns cwd, sessionId, and surface; do not supply replacements for those bindings.

Toolkit operations are help, create-goals, status, complete-goals, criteria, record-evidence, checkpoint, add-goal, steer, and record-review-blockers. Use the actual exposed tool or operator schema; these are operation identifiers, not shell commands. Inspect help if the invocation surface is unclear.

Keep the full request intact. Complete-goals selects or resumes an in-progress goal; its name does not mean that work has been completed. Inspect its returned goal and criteria, perform the work, recover any permitted worker reports, and inspect the actual output. Record evidence for essential criteria before checkpointing completion. Unresolved review blockers prevent completion.

A failure, question, stopped parent, missing plan, model error, or exhausted budget is not completion. Preserve evidence and the next actionable step. Resume only when authorized and after reconciling saved state. Before reporting the entire request complete, confirm aggregate completion and independently check every requested output, integration check, delivery requirement, and cleanup.
