---
name: debugging
description: Diagnose reproducible and intermittent failures using runtime evidence, then verify and deliver the repair.
---

# Debug and deliver a verified repair

Start from the user's failing behavior and completion criteria. Use GPT 6.1 Sol with low reasoning. Do not create workers or external review sessions unless the user authorizes them. Preserve explicit stops, permissions, model restrictions, project records and unrelated changes.

Prepare an owned reproduction using [setup](references/methodology/00-setup.md), then [investigate](references/methodology/02-investigate.md). For intermittent failures use [flaky triage](references/methodology/03-flaky-triage.md). Compare competing explanations with [three review perspectives](references/methodology/04-oracle-triple.md); seek missing evidence through [escalation](references/methodology/05-escalate.md). Follow [repair](references/methodology/06-fix.md), [acceptance](references/methodology/08-qa.md), and [cleanup](references/methodology/09-cleanup.md). A hypothesis or passing unit test alone is not completion. Mark [partial runtime evidence](references/methodology/partial-runtime-evidence.md) explicitly.

Choose the observed runtime: [Node](references/runtimes/node.md), [Python](references/runtimes/python.md), [Go](references/runtimes/go.md), [Rust](references/runtimes/rust.md), [native executable](references/runtimes/native-binary.md), or [bundled JavaScript](references/runtimes/bundled-js-binary.md). Inspect actual versions and available commands before using debugger-specific flags. Do not install an adapter globally or attach to an unrelated process merely because a guide names it.

Use tools for a concrete evidence gap: [DAP](references/tools/dap.md), [browser QA](references/tools/browser-qa.md), [Frida](references/tools/frida.md), [Ghidra](references/tools/ghidra.md), [Pwndbg](references/tools/pwndbg.md), or [Pwntools](references/tools/pwntools.md). Tool availability and successful imports are not proof that an observation was made. Record process, build, input, command, output and verification scope. Prefer inspecting an owned reproduction before attaching to production.

The references/scripts/dap.mjs helper exports byte-frame parsing and endpoint classification, not a complete debugger client. references/scripts/fixture-adapter.mjs is a synthetic transport fixture; its results never establish real debugger support. Keep implementation, fixture evidence, real runtime evidence and unresolved acceptance separate. Continue authorized diagnosis and repair until the user's completion criteria are met, or record a specific external blocker after trying available alternatives.
