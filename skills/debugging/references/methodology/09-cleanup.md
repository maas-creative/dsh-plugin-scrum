# Finish with preserved evidence and owned cleanup

Stop debugger connections, owned child processes, watchers and temporary servers. A launch-owned debuggee and an attached existing process have different lifecycles; do not terminate a foreign process merely to close an attachment. Wait for cleanup completion and record failures instead of silently dropping them.

Keep reproductions, regression tests and sanitized evidence needed for review. Remove only disposable directories created by this investigation. Preserve existing history, deadlines, submissions and unrelated working changes. Confirm the delivered package contains required source and notices and excludes private evidence and secrets.

Summarize the repaired behavior, validation scope and remaining material limitations. Release or deploy only within the authorized scope after acceptance. Do not equate a clean temporary directory or a staged package with completion of the requested product.
