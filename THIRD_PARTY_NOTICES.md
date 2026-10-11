# Third-party source and notices

Scrum retains each component's own license and attribution. The table below identifies incorporated components; it does not relicense them. The independent-implementation inventory and final whole-package license audit remain separate release gates.

| Component | Source | License and retained notice | Preferred source / provenance |
| --- | --- | --- | --- |
| Agent session finder | [coding-agent-sessions-ts](https://github.com/code-yeongyu/coding-agent-sessions-ts), commit dcb9cef579a53d7bec81baadd69b8445acf9d972 | MIT, `vendor/session-finder-independent/LICENSE` | `vendor/session-finder-independent` |
| Language-server recipes | [Mason registry](https://github.com/mason-org/mason-registry), commit ee10e9db59f13054eea925042cae6d1df461ec25 | Apache-2.0, `vendor/lsp-registry/MASON-LICENSE` | `vendor/lsp-registry/PROVENANCE.json` |
| Language-server configuration metadata | [nvim-lspconfig](https://github.com/neovim/nvim-lspconfig), commit c59fc922f718fa055f69f5f3bc888f23211571eb | Apache-2.0, `vendor/lsp-registry/LSPCONFIG-LICENSE` | `vendor/lsp-registry/PROVENANCE.json` |
| Comment checker | [go-claude-code-comment-checker](https://github.com/code-yeongyu/go-claude-code-comment-checker), npm @code-yeongyu/comment-checker 0.8.0 | MIT, `vendor/comment-checker/LICENSE` | Native binary source identities recorded in the component-origin audit |
| Public web reader | [insane-search](https://github.com/fivetaku/insane-search) | MIT, `vendor/public-reader-independent/LICENSE` | `vendor/public-reader-independent/provenance.json` |
| AST search skill | [ast-grep-skill](https://github.com/code-yeongyu/ast-grep-skill), commit 3148c69c370a51afb661b9f37879c0bd7cf0cc3b | MIT, `skills/ast-grep/LICENSE` | `skills/ast-grep/provenance.json`; independent adaptations are identified per file |
| Browser runtime | [OmOWright](https://github.com/code-yeongyu/omowright) | MIT, `vendor/browser-independent/LICENSE` | Preferred source and build records in `vendor/browser-independent` |
| Antigravity integration | [dsh-antigravity-auth](https://github.com/suntianc/dsh-antigravity-auth), commit 4a4ccd36958581bec497e30e008c50f155e24bea | MIT, `vendor/antigravity-notices/DSH-AUTH-LICENSE` | `vendor/antigravity-source/dsh-auth`, source manifest and rebuild recipe |
| Antigravity core | [antigravity-auth](https://github.com/cortexkit/antigravity-auth), v2.2.0 commit 351c2bf09f007792e7bc183ba73d11e2c57146fe | MIT, `vendor/antigravity-notices/CORE-LICENSE` | `vendor/antigravity-source/core`; exact TypeScript compilation and bundle reproduction |
| Web-access adapter | [pi-web-access](https://github.com/kvidzibo/pi-web-access), 0.1.1 | MIT, `vendor/pi-web-access-LICENSE.md` | `vendor/web-access-source`; attribution, redirect policy and inspection export adaptations recorded in `vendor/pi-web-access-provenance.json` |
| Git worktree creation | [pi-agent-orchestrator](https://github.com/GroepOnline/pi-agent-orchestrator), commit 7208bdb089f15c7d371407531d53394fb2a61f6a | MIT, `vendor/LICENSE.orchestrator` | `vendor/worktree-source`; only createWorktree is bundled |
| UI schema validation | [Zod](https://github.com/colinhacks/zod), 4.6.5 | MIT, `vendor/client-build-source/zod/LICENSE` | TypeScript preferred source in `vendor/client-build-source/zod/src`; UI rebuild recipe in package.json |
| Browser WebSocket transport | [ws](https://github.com/websockets/ws), 8.22.0 | MIT, `vendor/client-build-source/ws/LICENSE` | Preferred JavaScript source in `vendor/client-build-source/ws`; build recipe `browser-runtime-build.mjs` |
| Archive extraction | tar 7.5.22 and yauzl 3.4.0 | BlueOak-1.0.0 / MIT, notices in `vendor/archive-dependencies` | Installed npm dependencies retain their source and license files |

Installed npm dependencies retain their own copyright and license files. They are recorded separately by the production-dependency audit. Language servers installed on request are separate programs with their own licenses; a recipe's license does not license the server executable. Acceptance-only Java, OCaml, Haskell and Kotlin toolchains under the private work directory are not part of the Scrum package.

Historical OMO source snapshots are private audit material. Their Sustainable Use License is not evidence of AGPL compatibility and is not transferred to independently implemented Scrum code. Scrum package metadata now declares AGPL-3.0-only for its independently authored source. Final distribution acceptance is still a release gate; npm publication remains disabled. Historical protected snapshots are not included or relicensed.
