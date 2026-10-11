---
name: programming
description: Implement and verify software changes in Go, Python, Rust and TypeScript. Use the repository's existing stack and inspect the full caller-to-output path.
---

# Programming with Scrum

Begin with the requested behavior and an observable acceptance case. Locate the code that accepts the input, transforms it, saves it and presents the result. Read the repository's instructions and build configuration before choosing libraries or changing public interfaces. A passing isolated helper test does not prove that its caller uses the helper correctly.

## Execution workflow

1. Record the affected input, expected output and records that must remain unchanged. For a defect, reproduce the failing case before fixing it when feasible.
2. Identify callers, ownership, cancellation, error propagation and persistence boundaries. Preserve compatibility deliberately; do not silently rename a persisted field or discard a previous record.
3. Implement the smallest complete change. Keep validation at external boundaries and represent distinct states explicitly. Do not replace an actual failure with an empty success result.
4. Run relevant formatting, static analysis and behavior tests. Include failure, restart or duplicate-delivery tests when the change affects durable work. Avoid tests that only repeat the implementation.
5. Exercise the real entry point and inspect the resulting artifact. For agent work, verify delegation, collection, artifact validation and cleanup rather than treating worker exit as the project's completion.
6. Review the changed code with its callers. Report the verified behavior, test evidence and remaining limitations; claim completion only for the scope actually exercised.

## Language references

Choose the language already used by the project. Open the relevant index, then the topic needed for the change:

- [Go](references/go/README.md): modules, contexts, typed errors, services and tests.
- [Python](references/python/README.md): typed boundaries, packaging, async tasks, data and HTTP services.
- [Rust](references/rust/README.md): ownership, recoverable failures, CLI/services and concurrency.
- [Rust memory safety](references/rust-ub/README.md): unsafe review and diagnostic tools.
- [TypeScript](references/typescript/README.md): runtime validation, narrowing, API boundaries and compiler settings.
- [Review warning signs](references/code-smells.md) and [logging](references/logging.md).

## Included helpers

Resolve helper paths relative to this skill directory. Generators refuse an existing destination and do not authorize deployment. Check the generated project's commands before installing dependencies. Use a private fixture to try a generator when the real target already exists.

```sh
python3 scripts/go/new-project.py example --path /path/to/parent
python3 scripts/python/new-project.py example --path /path/to/parent
python3 scripts/python/new-script.py example --output /path/to/example.py
python3 scripts/rust/new-project.py example --path /path/to/parent
node scripts/typescript/new-project.ts example --path /path/to/parent
```

Source-policy checks supplement the language's compiler, type checker and tests:

```sh
bash scripts/go/check-no-excuse-rules.sh /path/to/changed/files
python3 scripts/python/check-no-excuse-rules.py /path/to/changed/files
bash scripts/rust/check-no-excuse-rules.sh /path/to/changed/files
node scripts/typescript/check-no-excuse-rules.ts /path/to/changed/files
```

A policy diagnostic is a review obligation, not proof that the program cannot run. Explain the concrete case and fix the underlying problem. Do not add blanket suppression merely to produce a green check. Exit status 2 indicates inspection could not run; it must not be reported as a successful inspection.

## Evidence and boundaries

Use synthetic data for initial execution. Keep credentials and production records out of fixtures. Bound network retries and parallel work, propagate cancellation and close owned resources. For migrations, take an appropriate backup and compare preserved records after the change. Document a genuine authorization barrier precisely while continuing independent work.

This guide is independently authored for Scrum. Language facts should be checked against the project's installed version and the official documentation: [Go](https://go.dev/doc/), [Python](https://docs.python.org/3/), [Rust](https://doc.rust-lang.org/book/) and [TypeScript](https://www.typescriptlang.org/docs/).
