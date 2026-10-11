# Python implementation guide

Use the repository's Python version, package layout and locked environment. Validate external inputs and distinguish an empty result from a failed operation. Preserve existing records and exercise the actual entry point before claiming completion.

## Topics

- [Own asynchronous work](async-anyio.md)
- [Typed domain records](data-modeling.md)
- [Reproducible data transformations](data-processing.md)
- [Preserve failure meaning](error-handling.md)
- [HTTP services with FastAPI](fastapi-stack.md)
- [Reuse HTTP connections safely](httpx2-optimization.md)
- [Dependencies with a reason](libraries.md)
- [Verification commands](one-liners.md)
- [JSON bytes and schema boundaries](orjson-stack.md)
- [Typed agent outputs](pydantic-ai.md)
- [Project configuration and quality tools](pyproject-strict.md)
- [Responsive terminal applications](textual-tui.md)
- [Types that constrain real states](type-patterns.md)

The included new-project.py supports application and library scaffolds; new-script.py creates a standalone script with inline dependency metadata. Both refuse existing outputs. Source-policy checks supplement pytest, Ruff and basedpyright; they do not replace them. See the [Python documentation](https://docs.python.org/3/) for the installed language version.
