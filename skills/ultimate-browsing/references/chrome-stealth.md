# Connected browser workflow

Use the browser already authorized by the host. Enumerate its visible state, select the intended tab, and inspect current controls before acting. The Scrum connection guard enforces the owning session and rejects raw transport calls, other session IDs, and unguarded browser launch exports.

Keep persistent browser handles within that session. Refresh the page state after navigation or any control that changes the document. Use labels and current element references rather than guessed coordinates. For a rich editor, verify the resulting text in the editor before submitting. A disabled control, authentication challenge, or missing extension is an actionable state, not permission to bypass it.

A browser action that writes externally must satisfy host permissions and the user's authorization. Preserve unsent work when interrupted. A host stop invalidates continuation; do not reconnect automatically. If the extension or daemon is missing, report that specific connection error. The public reader's optional automation backend is distinct from the user's connected browser and must not be substituted silently.

Finish with observed evidence: submitted receipt, downloaded file, updated field, or resulting URL. Screenshots supplement readable state; they do not prove an unseen server-side change.
