# Own asynchronous work

Use a task group to give concurrent operations a common lifetime. Bound work with a capacity limit and propagate cancellation instead of detaching tasks. Keep blocking I/O or CPU work off the event loop. AnyIO API details depend on the installed version; do not assume a newer task-handle method exists in an older project.

## Verification

Test sibling failure, cancellation during I/O and cleanup that itself fails. Confirm no owned worker remains after its scope closes. Use explicit events rather than arbitrary sleeps to prove readiness. A task group exit is not proof that a returned artifact is correct.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Own asynchronous work](https://anyio.readthedocs.io/en/stable/tasks.html). The operational policy is independently authored for Scrum.
