# Create a TypeScript project

Respect the existing runtime and lockfile. The included new-project.ts creates a Bun/Hono starter in an empty destination. Run it with Node 24 or Bun, inspect the generated files, then install dependencies in that project. The starter has health and validated echo routes; it is not a finished production service.

## Execution

```sh
node scripts/typescript/new-project.ts example --path /path/to/parent
cd /path/to/parent/example
bun install
bun run check
```

Run commands from the appropriate project or skill directory and use the existing package manager when it differs.

## Acceptance

Start the server on an owned loopback port and request the actual routes. Confirm malformed input is rejected and stop the owned process. Do not rerun the generator over an existing destination.

Official API reference: [Create a TypeScript project](https://hono.dev/docs). The operational guidance is independently authored for Scrum.
