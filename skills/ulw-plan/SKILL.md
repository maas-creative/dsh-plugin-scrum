---
name: ulw-plan
description: Create a verifiable implementation plan for Scrum HardTackle while preserving the full requested outcome.
---

# Plan the complete outcome

Treat the requested product and its completion condition as the scope. Separate independently verifiable outputs into tasks, record dependencies, and include final verification and owned-resource cleanup. Do not turn difficult requirements into exclusions. Do not limit a plan to five tasks.

When the intent is clear, follow [the clear-intent guide](references/intent-clear.md). When the requested outcome is ambiguous, follow [the unclear-intent guide](references/intent-unclear.md). Keep progress on independent work while obtaining genuinely missing information. Existing authorization remains valid.

Use [the execution workflow](references/full-workflow.md) to connect planning with implementation and evidence. The optional `scripts/scaffold-plan.mjs --help` helper writes a new `.scrum/plans/*.md` document with labeled TODOs and a final verification wave. It refuses to overwrite existing plans and does not activate HardTackle or launch agents. Update the plan through the host filesystem guards.

Scrum’s execution entry is `hdt` / HardTackle. The `ulw-plan` skill name remains a compatibility identifier. Default to the user’s model and delegation policy: GPT 6.1 Sol low, and no delegated agents without authorization. An approved plan is an implementation obligation, not permission to finish at an intermediate milestone.
