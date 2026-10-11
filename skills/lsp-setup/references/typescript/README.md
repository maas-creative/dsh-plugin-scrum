# typescript language server setup

Start from the project directory and run the detection helper. Detection reads filenames and resolves configured executables; it does not install packages or start servers. Pass `--config /path/to/config.jsonc` to detection as well as verification when using a custom configuration.

```bash
node /path/to/Scrum/skills/lsp-setup/scripts/detect-lsp.ts --cwd /path/to/project
```

Available registry entries:

## typescript

Launch arguments: `["typescript-language-server", "--stdio"]`.
Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`.
Package recipe: `pkg:npm/typescript-language-server@6.0.1`.
Server documentation: https://github.com/typescript-language-server/typescript-language-server.

## deno

Launch arguments: `["deno", "lsp"]`.
Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`.
Package recipe: `pkg:github/denoland/deno@v2.9.7`.
Server documentation: https://deno.land/.

## biome

Launch arguments: `["biome", "lsp-proxy"]`.
Supported extensions: `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`, `.json`, `.jsonc`, `.vue`, `.astro`, `.svelte`, `.css`, `.graphql`, `.gql`, `.html`.
Package recipe: `pkg:npm/@biomejs/biome@2.5.15`.
Server documentation: https://biomejs.dev.

Use a project JSONC configuration with an `lsp` object when the runtime or command differs. A server entry accepts an explicit command array, extensions, environment, initialization options and settings. Avoid shell command strings. An explicit command is authoritative and does not fall back to installing a different package.

Verify a representative source file with `verify-lsp.ts --cwd /path/to/project --file relative/source --config /path/to/config.jsonc`. Verification performs the actual LSP initialize/open/document-symbol exchange and closes the verification process. A successful executable lookup alone is not an LSP acceptance test.

Automatic installation requires the host installation decision for that server. npm, Python, Go, .NET, GitHub releases, fixed-origin downloads, isolated RubyGems and opam, and owned GHCup prefixes have installer paths. Availability still depends on the selected server recipe, compatible toolchain and platform. Verify the actual server protocol and report unresolved requirements; an installer path does not prove every server works on every host. Preserve project toolchain and server version requirements.
