# Logging useful execution evidence

Design logs around questions an operator must answer: which operation ran, for which owner, what state changed, why it stopped and whether a retry is safe. Assign a stable operation ID and correlate parent, worker and artifact records. Keep event time and receipt time separate when delivery can be delayed.

## Event structure

Use stable fields such as event, operation_id, owner_id, state, duration_ms and error_kind. Put variable prose in a message field. Log a transition once at its owner; repeated forwarding should retain the event ID rather than inventing a new completion event. An error's stack belongs in restricted diagnostics, while the UI needs a readable explanation and the next safe action.

## Sensitive data

Do not log tokens, authorization headers, cookies, full user documents or environment dumps. Prefer a credential profile ID over its value. Limit captured command output and redact before persistence. A debug flag must not disable these rules. Test redaction with a synthetic secret and inspect the saved output, not just the sanitizer's return value.

## Language integration

In Python, obtain a module logger with `logging.getLogger(__name__)` and configure output at the application boundary. Avoid attaching duplicate handlers throughout the library tree. In Go, use the project's structured logger and pass the operation fields with the event. In Rust and TypeScript, preserve the existing logger and correlation mechanism rather than introducing a second unrelated stream.

## Failure and retention

Bound log size and retention. Logging failure must not falsely mark an operation complete or replace its original exception. If audit persistence is mandatory for a sensitive action, fail before the action and expose the reason. Otherwise, retain the original application failure and report the logging problem separately. Distinguish a live process from a stale log or lock file.

The Python logger and handler behavior is documented in the [standard logging API](https://docs.python.org/3/library/logging.html). The cross-language operational policy above is Scrum's own guidance.
