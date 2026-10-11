# TypeScript implementation guide

Keep the project runtime, compiler version and lockfile explicit. Trace input validation, side effects and user-visible output. Execute behavior tests as well as compiler and formatting checks.

## Topics

- [Create a TypeScript project](bootstrap.md)
- [HTTP contracts with Hono](backend-hono.md)
- [Records and discriminated states](data-modeling.md)
- [Failures that reach the owner](error-handling.md)
- [Compiler settings match the runtime](tsconfig-strict.md)
- [Narrow values instead of asserting](type-patterns.md)

The generator and policy checker work through Node 24 or Bun. The checker uses the installed compatible TypeScript AST API and reports inspection failures distinctly from diagnostics. Neither script proves a feature is complete. Consult the [TypeScript documentation](https://www.typescriptlang.org/docs/) for the installed release.
