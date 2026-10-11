# Dependencies with a reason

Prefer standard modules for filesystem paths, process invocation, JSON, logging and simple CLI parsing. Introduce a library for a concrete capability and inspect its version, transitive dependencies, maintenance and distribution license. Keep installation and runtime use separate so a missing dependency is an explicit setup failure.

## Verification

Use the project lockfile and exercise the actual external boundary after updating a dependency. Check that packaging includes runtime resources and excludes secrets and caches. Do not infer functional compatibility from successful installation.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Dependencies with a reason](https://packaging.python.org/en/latest/). The operational policy is independently authored for Scrum.
