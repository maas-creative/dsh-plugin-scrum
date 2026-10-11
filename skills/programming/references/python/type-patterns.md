# Types that constrain real states

Use unions and discriminating fields to represent alternatives, Protocol for a genuine consumer contract and TypedDict for a known dictionary interface. Type hints do not validate runtime network input. Narrow at the boundary and handle all variants explicitly instead of casting away uncertainty.

## Verification

Run the type checker and test invalid external values. A cast does not transform or validate a value. Review optional values where absence differs from an empty result. Maintain compatibility for serialized fields when types or state names change.

From the existing project environment, run applicable checks:

```sh
uv run pytest
uv run ruff check .
uv run basedpyright
```

Use the project's configured paths and tests; these commands do not prove an unexercised API or model works. Official version reference: [Types that constrain real states](https://docs.python.org/3/library/typing.html). The operational policy is independently authored for Scrum.
