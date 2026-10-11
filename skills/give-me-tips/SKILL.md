---
name: give-me-tips
description: Offer practical improvements grounded in the current Scrum installation and the user's workflow.
---

# Give actionable advice from actual state

Inspect the current task and installation before suggesting configuration changes. Use GPT 6.1 Sol with low reasoning and respect the user's delegation restrictions. Read available lifecycle diagnostics, configured roles and models, tool availability, observed failures and verified results. Do not inspect unrelated private data just to personalize advice.

Prioritize the bottleneck that prevents the user's intended result. Explain one concrete change, its expected benefit, the evidence behind it and how to verify it. Prefer a small number of relevant recommendations over a catalog of every tool. Distinguish a measured improvement from a hypothesis or synthetic example; do not invent token savings, cache hit rates or latency numbers.

Scrum supplies execution, delegation, collection, verification and continuation. Dashboard is a separate product and plugin for project records and UI. Either can run independently or together. Recommendations must not require a Dashboard ledger for Scrum-only use. Activating HardTackle or hdt does not prove that workers are running; inspect actual assignments, state, reports and artifacts.

For model or provider advice, preserve the configured model restriction and verify availability through the actual catalog and authentication state. A saved provider setting is not proof of successful login or execution. Do not change models, grants, notification preferences or persistent configuration while merely giving advice. If the user requests implementation, carry the accepted change through validation rather than returning another plan.

For stalled work, inspect waiting reasons, failures, ownership, pending results and cleanup. Recommend recovery tied to a specific failed boundary. Prefer explicit output criteria, verified artifacts, stable report IDs and restart-safe state to vague instructions to be more autonomous. An explicit stop must remain stopped.

Conclude with the most useful next action and its verification, scaled to the user's immediate goal. Say which observation supports the advice. Keep unverified integrations and broader platform assumptions visible rather than promising that an option will work everywhere.
