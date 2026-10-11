# Reproducible data transformations

Retain the original input and record its schema, units, timezone and missing-value rules. Choose the existing dataframe or columnar library rather than changing stacks for a minor transformation. Bound memory use with projection, batching or lazy execution when inputs are large. Treat parsing errors as errors rather than silently dropping rows.

## Verification

Verify row counts before and after joins, uniqueness of join keys, null behavior and aggregate totals on a small independently calculated fixture. Record dropped or rejected rows and why they were rejected. Re-run from the original data to show the output is reproducible.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Reproducible data transformations](https://docs.pola.rs/). The operational policy is independently authored for Scrum.
