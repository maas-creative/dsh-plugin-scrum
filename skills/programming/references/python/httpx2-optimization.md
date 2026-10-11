# Reuse HTTP connections safely

This filename is retained for compatibility; it does not assert that a package named HTTPX2 is required. Use the installed HTTPX Client or AsyncClient to share connection resources. Configure timeouts and pool limits deliberately. Keep credentials scoped to their origin and inspect redirects before carrying authorization across an endpoint change.

## Verification

Test connection failure, response-size limits, timeout and cancellation. Close responses and clients, including streaming responses. Measure actual request duration and resource use before claiming an optimization. A retry must not duplicate a submitted write.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Reuse HTTP connections safely](https://www.python-httpx.org/advanced/clients/). The operational policy is independently authored for Scrum.
