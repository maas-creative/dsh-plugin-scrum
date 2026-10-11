---
name: frontend
description: Build a clear, accessible interface that exposes the user's actual workflow and verified state.
---

# Implement the interface around the user's task

Identify the primary action, information needed before it, and observable successful result. Preserve the existing product direction and design system unless a change is requested. Use GPT 6.1 Sol with low reasoning and do not delegate without authorization. Read the actual components, data contracts, styles and repository instructions before editing.

Use a clear hierarchy: navigation establishes location, the main area supports the current task, and secondary context contains artifacts, sources and worker details. Keep completion, deletion, merge and archive distinct when they have different persistence effects. Avoid exposing provenance or implementation bookkeeping in the primary flow unless it helps the user decide. Preserve records behind presentation changes.

For agent conversations, render messages in order with explicit authors and readable spacing. Start with an empty input unless the user selected a real draft. Keep active execution, waiting, errors and stopped states visible. Place stopping controls near the active state rather than below a long transcript. Show artifacts and related workers as secondary context with explicit empty, unavailable and loading states. An empty list must not masquerade as successful retrieval.

Use shared tokens and reusable components for type, spacing, color, borders and layout. Establish responsive constraints from content rather than fixed screenshot coordinates. Keep dialogs within the viewport, isolate scrolling deliberately, preserve history position while reading older messages and keep the input reachable. Secondary panels should collapse or become accessible sheets at narrow widths without hiding the primary task.

Use semantic controls, associated labels, visible focus, keyboard operation and accessible names. Maintain readable contrast, adequate target sizes and error messages that identify an actionable cause. Do not encode state only in color. Preserve focus when opening and closing dialogs; avoid trapping users behind a backdrop or moving focus during background updates.

Trace the real request and state write behind each action. A success toast or optimistic row removal is not persisted completion. Handle loading, retry, cancellation, concurrent updates and unavailable connections honestly. Render untrusted text safely and keep credentials out of client logs. Distinguish a reported result from a verified artifact.

Verify the actual UI with representative data on desktop and narrow widths. Exercise the original user sequence, keyboard paths, empty and failure cases, and persisted state after reload. Screenshots support review but do not establish backend correctness. Run relevant standard checks, review connected callers and deliver the final behavior without declaring completion while required acceptance remains open.
