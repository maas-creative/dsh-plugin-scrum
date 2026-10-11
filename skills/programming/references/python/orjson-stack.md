# JSON bytes and schema boundaries

Use orjson only when its measured behavior or speed is useful to the project. Its dumps result is bytes, so choose a byte-oriented sink or perform an intentional UTF-8 conversion. Define supported date, number and custom-object serialization semantics before changing from the standard JSON library.

## Verification

Test a round trip, malformed input, unsupported types and boundary numeric values. Compare the actual persisted or HTTP bytes with the required schema. Do not use a serialization callback to hide an unknown object as a misleading string.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [JSON bytes and schema boundaries](https://github.com/ijl/orjson). The operational policy is independently authored for Scrum.
