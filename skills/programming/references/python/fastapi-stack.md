# HTTP services with FastAPI

Validate request and response schemas explicitly and keep domain work outside the route function. Authentication and authorization are separate checks; validate ownership immediately before a mutation. Create long-lived resources in the application lifecycle and close them on shutdown. Do not call blocking I/O directly from an asynchronous route.

## Verification

Use a real application client for malformed input, missing credentials, forbidden ownership, successful mutation and its subsequent read. Test startup failure and resource cleanup. Set upload and response limits; framework schema validation does not establish domain authorization.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [HTTP services with FastAPI](https://fastapi.tiangolo.com/tutorial/). The operational policy is independently authored for Scrum.
