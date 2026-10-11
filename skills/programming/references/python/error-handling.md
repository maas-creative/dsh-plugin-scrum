# Preserve failure meaning

Use domain-specific exceptions when callers need to choose a recovery action. Add context using exception chaining and retain the original cause. Catch only where recovery or public reporting is possible. Do not turn a broad exception into an empty success result or suppress cancellation.

## Verification

Exercise the actual failing boundary and verify both the caller-visible error and preserved records. A retry must be bounded and safe for the side effect. Keep internal traces restricted and report an actionable reason to users.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Preserve failure meaning](https://docs.python.org/3/tutorial/errors.html). The operational policy is independently authored for Scrum.
