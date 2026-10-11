# Narrow values instead of asserting

Use runtime checks to narrow unknown input. Handle discriminated unions exhaustively and reject invalid external values. A type assertion does not convert or validate a value. Avoid any and non-null assertions when an actual check can establish the contract.

## Execution

```sh
bunx tsc --noEmit
node scripts/typescript/check-no-excuse-rules.ts /path/to/changed/files
```

Run commands from the appropriate project or skill directory and use the existing package manager when it differs.

## Acceptance

Test null, missing properties and unexpected variants. Review guards against the real schema. The source-policy helper supplements typechecking; its diagnostics do not prove runtime authorization or successful side effects.

Official API reference: [Narrow values instead of asserting](https://www.typescriptlang.org/docs/handbook/2/narrowing.html). The operational guidance is independently authored for Scrum.
