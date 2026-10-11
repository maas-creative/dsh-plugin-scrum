# Responsive terminal applications

Keep visible state in the app model and communicate worker results through the framework message mechanism. A long-running operation must show progress, permit cancellation and avoid blocking rendering. Use stable operation IDs to discard stale responses when selection changes. Consult the installed Textual version for workers and testing APIs.

## Verification

Exercise keyboard focus, narrow terminal layouts, resize, error states and cancellation. Use the framework test pilot for behavior and also inspect a real terminal. Cleanup must restore terminal state and stop only resources owned by the operation.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Responsive terminal applications](https://textual.textualize.io/guide/). The operational policy is independently authored for Scrum.
