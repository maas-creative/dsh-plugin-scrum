---
name: lsp-setup
description: Detect project language servers and verify a configured server through Scrum’s independent LSP client.
---

# Set up language intelligence

Identify the project root and a representative source file. Run `node <skill-directory>/scripts/detect-lsp.ts --cwd <project>` to list matching configured servers, executable availability and package recipes. The scan excludes symlinks and dependency/build directories and reports when its file limit is reached. Detection does not change the project or install software. When using a custom JSONC configuration, pass the same `--config <config-jsonc>` to both detection and verification; default-registry detection does not observe a separately supplied verification configuration.

Choose a server compatible with the project’s language and toolchain. Consult the corresponding [language references](references/typescript/README.md) and the server vendor documentation. Preserve an existing configuration. Configuration is JSONC with an `lsp` object; per-server commands are literal argument arrays. Do not replace a project-specific server with a global installation without checking its requirements.

Run `node <skill-directory>/scripts/verify-lsp.ts --cwd <project> --file <relative-source> --config <config-jsonc>` in its own CLI process. Verification uses the independent client, initializes the actual server, opens the file and queries document symbols when supported. The client is shut down before the CLI returns. This CLI owns its verification process; do not embed its global cleanup helper in an unrelated running host.

Missing servers require an allowed host installation decision before automatic installation. npm, Python, Go, .NET, GitHub releases, fixed-origin generic downloads, RubyGems and isolated opam packages have installation paths. Haskell Language Server uses an isolated GHCup prefix. Installation still requires a compatible host toolchain; verify the selected server through its actual protocol rather than treating a successful download as acceptance. An existing executable can be configured explicitly. Do not claim installation or verification succeeded from configuration alone.

Report the selected server, actual executable, verification result and unresolved toolchain requirements. Preserve diagnostics and source contents; this setup skill does not edit source files to make a verification pass.

The built-in Haskell wrapper uses `+RTS -N2 -RTS` to bound startup parallelism. A custom command replaces these defaults. HLS still requires a compatible project GHC on PATH; an installation receipt does not demonstrate successful project initialization.
