---
name: hardtackle
description: Execute authorized work through planning, delegation, evidence review and owned-resource cleanup.
metadata:
  short-description: "Persistent HardTackle execution"
---

# HardTackle execution

Read the user's full request and identify the deliverable, acceptance conditions, constraints and authorized actions. Keep these conditions throughout execution; do not replace them with whichever subset has passed.

Use the existing plan when supplied. Otherwise inspect the current project, identify dependencies and write an executable plan. Resolve routine choices yourself. Ask a focused question only when missing information prevents the dependent work; continue independent work while awaiting the answer.

Scrum operates independently of a project dashboard. A mode activation without a work request must not invent a goal, register a project or start workers. Dashboard records are optional host context, not required execution IDs.

For authorized delegation, register a task with its body, expected output and completion criteria. Use the task execution tool to assign the work, including file ownership and required model configuration. Tell each worker that others may be editing the workspace and that their changes must be preserved. Do not delegate when the user forbids it. Respect configured concurrency, permissions and resource budgets.

Retain task and worker identifiers. Collect background results, failures and questions; an accepted dispatch is not a completed task. Inspect the returned artifacts and run the relevant checks. A worker's success statement is evidence to inspect, not proof that the whole request is finished. Failed or uncertain execution must be reconciled before a retry can cause duplicate side effects.

Use scrum_review to evaluate outputs against their acceptance criteria. Integrate verified outputs and reflect actual task progress. Continue remaining dependent work, corrections and verification. Retain useful artifacts when a worker fails or is replaced.

Handle questions, model errors, compaction and restarts by preserving the plan and recorded state. Resume only when permitted. An explicit human stop suspends continuation; neither an idle event nor a new worker result overrides it. Budget exhaustion is a reported limit, not successful completion.

Before completion, compare every requirement with current authoritative evidence. Close this parent's Teams, monitors and isolated resources; preserve other parents' resources and user history. Deliver the result with relevant test evidence and explicit remaining blockers. Report completion only when the entire authorized request and required cleanup are verified.

User authorization takes precedence over this workflow. Preserve the configured model; in this project use GPT 6.1 Sol with low reasoning. Do not create subagents when delegation is prohibited.
