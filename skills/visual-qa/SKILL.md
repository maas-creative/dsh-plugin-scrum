---
name: visual-qa
description: Verify the actual rendered interface and its interactions against the user's workflow and design system.
---

# Verify the real interface

Identify the page, intended task, design reference and representative data. Use GPT 6.1 Sol with low reasoning and do not create reviewers unless authorized. Inspect the live rendered application through the configured browser or app tool. A pasted screenshot, static mock or generated image does not establish that the product works.

Check hierarchy, alignment, type, spacing, contrast, responsive proportions and the relationship between main content and secondary panels. Use shared tokens and actual components rather than screenshot-specific coordinates. Inspect long text, many rows, empty lists, loading, errors and missing connections. Keep agent state, stop controls, reports and artifacts intelligible.

Exercise the user's sequence: opening the view, entering input, submitting, seeing progress and response, completing or merging work, and reloading persistent state. Verify keyboard access, associated labels, focus movement and dialog closure. Check desktop and relevant narrow widths; ensure the primary task and input remain reachable without unintended horizontal overflow.

Capture screenshots of actual states and record viewport, application version and tested input. When reading history, verify that background updates preserve the reader's position. Distinguish UI evidence from backend receipts and inspect both where completion depends on persistence. Do not hide errors behind a success toast or represent a blank panel as an empty verified result.

Fix concrete findings and repeat the affected scenario. Run relevant standard checks and verify the final rendered build after the fix. Report remaining material gaps honestly while continuing authorized work. A visually improved page is not completion if the requested workflow still fails.
