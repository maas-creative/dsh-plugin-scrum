---
name: remove-ai-slops
description: Review and remove unnecessary generated changes without weakening behavior.
argument-hint: "[file ...]"
---

# Review generated changes against the requested outcome

The user's current request takes precedence. Use GPT 6.1 Sol with low reasoning. Do not delegate without explicit permission. Review actual changes and connected callers before editing. Preserve intentional behavior, user constraints, existing records, and other contributors' edits.

Establish the baseline and scope: changed files, requested behavior, applicable instructions, relevant tests, and uncommitted work. Trace how inputs become state and outputs. Identify concrete unnecessary changes rather than judging authorship or presentation style alone.

Look for redundant abstractions, repeated logic, dead code, fabricated data, exception handling that hides failure, unsupported casts, broad suppression of diagnostics, configuration without a real consumer, dependencies added for trivial work, and comments that repeat implementation instead of explaining a constraint. Check whether an apparent redundancy is required by an API, compatibility contract, permission boundary, or recovery mechanism before removing it.

For each proposed removal, identify a concrete caller or behavior that proves it is unnecessary and verify what will replace it. Prefer the smallest complete solution using existing helpers or the standard library. Do not delete validation, cancellation, evidence capture, access checks, or restart handling merely because they make code longer. Do not replace functioning features with placeholders to improve apparent simplicity.

Edit only supported findings. Preserve public interfaces unless the requested change authorizes migration. Review affected callers and run meaningful checks for the changed behavior. A test that merely repeats implementation is insufficient. Inspect the final diff for accidental deletions and incomplete work.

Report what changed, why it was unnecessary, and what was checked. If findings need wider design work, retain them with concrete evidence. Do not claim the product complete because this cleanup is complete; compare against the full request and continue required implementation, verification, and delivery.

If explicit file arguments are supplied, use them to define the requested review scope and inspect their connected callers. Do not expand that scope into unrelated cleanup.
