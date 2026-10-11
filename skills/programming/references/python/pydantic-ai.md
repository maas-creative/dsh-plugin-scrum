# Typed agent outputs

Use the installed Pydantic AI version and configure the authorized model explicitly. Validate output structure, tool inputs and permission scope independently of model prose. Bound retries, tokens and concurrent tools. A structured model response is a proposed result until the real artifact and side effects have been verified.

## Verification

Start with synthetic tool data, then exercise the authorized model only where the task requires it. Test invalid output, tool failure, cancellation and a stop request. Keep credentials out of messages and logs. Report the actual model and integration boundary used.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Typed agent outputs](https://pydantic.dev/docs/ai/overview/). The operational policy is independently authored for Scrum.
