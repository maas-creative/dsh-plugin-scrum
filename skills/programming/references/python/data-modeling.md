# Typed domain records

Choose a dataclass for a trusted internal record and a validation model for untrusted external input. Frozen dataclasses express an immutable record intent; slots restrict instance fields, but neither validates field values automatically. Validate IDs, units, ranges and permitted state transitions before persisting a record.

## Verification

Load an older serialized record, distinguish missing values from meaningful zero values and exercise an invalid transition. Preserve record identifiers when merging tasks. Avoid ad hoc dictionaries when the output schema is known.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Typed domain records](https://docs.python.org/3/library/dataclasses.html). The operational policy is independently authored for Scrum.
