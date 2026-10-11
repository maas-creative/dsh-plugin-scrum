# Compiler settings match the runtime

Use strict checking and choose module, moduleResolution, target and libraries for the actual runtime and build pipeline. Consider noUncheckedIndexedAccess where indexing can miss a value. Keep runtime-specific ambient types separate from browser modules. Pin the compiler version before changing API-dependent tools.

## Execution

```sh
bunx tsc --noEmit
```

Run commands from the appropriate project or skill directory and use the existing package manager when it differs.

## Acceptance

Compile the actual entry points and generated declarations where shipped. Do not suppress errors globally to accommodate one module. Node type stripping or Bun execution does not perform full type checking; run the compiler separately.

Official API reference: [Compiler settings match the runtime](https://www.typescriptlang.org/tsconfig/). The operational guidance is independently authored for Scrum.
