# Project configuration and quality tools

Keep package metadata, supported Python versions and tool configuration in pyproject.toml. Pin the environment through the lockfile. Ruff handles configured lint and formatting rules; basedpyright checks configured type constraints. Align include/exclude paths with the source layout and keep dependency caches outside analysis.

## Verification

Run pytest, Ruff and basedpyright in the same project environment used by the entry point. Inspect generated configuration before copying it into an existing repository. Do not disable an entire rule family to hide a specific failure; verify a narrow exception with evidence.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Project configuration and quality tools](https://docs.astral.sh/ruff/configuration/). The operational policy is independently authored for Scrum.
