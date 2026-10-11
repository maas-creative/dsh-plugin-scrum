# Verification commands

Run tools from the project root through its own environment. Preserve nonzero exit statuses and inspect the result. Avoid piping a failed producer into a command that masks its failure. The included generator creates application or library scaffolds in an empty destination; it does not modify an existing project.

## Verification

Run the relevant behavior tests as well as formatting, lint and type checks. An empty test collection is not behavior coverage. Record tool versions and keep a real entry-point check for changes that cross packaging or process boundaries.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Verification commands](https://docs.astral.sh/uv/guides/projects/). The operational policy is independently authored for Scrum.
