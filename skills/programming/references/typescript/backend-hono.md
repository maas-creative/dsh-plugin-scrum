# HTTP contracts with Hono

Keep HTTP decoding, domain operations and persistence separate. Validate external JSON at runtime, including request-size limits, ownership and permitted transitions. Use a schema library version already supported by the project. Configure long-lived resources and shutdown at the application boundary.

## Execution

```sh
bun run check
```

Run commands from the appropriate project or skill directory and use the existing package manager when it differs.

## Acceptance

Exercise the actual app fetch handler for malformed JSON, invalid shape, denied ownership and a successful mutation followed by readback. TypeScript types alone do not validate network input. Keep internal errors out of public responses.

Official API reference: [HTTP contracts with Hono](https://hono.dev/docs). The operational guidance is independently authored for Scrum.
