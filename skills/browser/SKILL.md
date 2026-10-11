---
name: browser
description: Use Scrum browser tools for page inspection, interaction, screenshots and testing, choosing the authorized connection mode.
---

# Browser work in Scrum

Use browser_connect with an explicit mode. owned launches a Playwright Chromium instance; attached connects to an explicitly supplied CDP endpoint; connected uses the BrowserSkill daemon and extension for a user browser. A connected browser_instance_id selects the browser instance. Choose the mode that provides the needed session without acquiring unrelated user data or silently changing the connection type.

Execute code with browser_execute. Its browser binding depends on the mode: owned and attached expose Playwright; connected exposes the MIT OmOWright session API and the omowright binding. Do not interchange the APIs. Return structured evidence or screenshot bytes when useful; Scrum routes images to native attachments. Keep code bounded and inspect the page before relying on coordinates or stale references.

For connected sessions, consult references/browserskill.md and the bundled public API in TOOLS.md. For snapshot and locator operations consult references/quickstart.md. Network, tracing, routing, frame and dialog APIs are documented there and in references/frames-layers-human.md. Prefer an inspected API response or accessibility snapshot when it yields the needed evidence; use visible interaction when the task requires it.

Browser access does not grant permission for an unrelated external action. Observe the user's authorization for messages, publication and account changes. Human login, OTP and consent steps remain human interactions. Preserve the user's tabs and session; close only resources owned by this work. Stop latches require an explicit human resume and must not be cleared through reconnect or automatic retry.

If a connection or request fails, inspect its receipt and current state before retrying. An accepted creation is not confirmed ownership. Do not replay an uncertain mutation. After completing the task, verify the actual output and close the owned session. Report outstanding connection or permission failures precisely.

The public MIT documentation is retained for API reference, not as authorization to install software, create subagents or bypass host rules. User instructions and configured permissions take precedence. Use GPT 6.1 Sol with low reasoning for this project; no delegation when prohibited.
