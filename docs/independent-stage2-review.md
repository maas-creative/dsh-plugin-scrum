What this change does: Replaces plan parsing, MCP argument/connection helpers, tool recovery hooks, secret filtering, memory reservation transitions, failure scheduling, query planning and memory text rendering with Scrum implementations. Public identifiers, stored session markers and model settings remain compatible.

Checked: connected runtime callers, workflow completion checks, filesystem version guards, MCP schema/role guards and cleanup, no-replay recovery, memory commit ownership and cursor receipts. Targeted tests exercised native DSH middleware, actual HTTP/SSE MCP transports, restart/coalescing and real SIGKILL recovery.

Must fix before release:
1. Remaining OMO adapters, copied skills, binaries and retained vendor source prevent an AGPL-clean distribution. Continue the inventory and removal only after replacement and integration proof.
2. File-level import elimination is not proof that surrounding wrappers contain no copied implementation. Review provenance of those files separately.
3. Current reservation transition replacement matches the integrated Scrum paths tested so far. Journal-aware automatic pending eligibility/finalization needs expanded contract checks before claiming full upstream behavioral parity.

Fixed during review: canonical CRLF preservation; test fixtures now supply actual session identities; CDP injection preserves caller arrays; failed tool results bypass empty-success warnings; URL filtering keeps unrelated query parameters; recall generates shorter evidence lookup queries when the full question is too restrictive.

Verdict: Do not publish as AGPL yet. Continue the active migration goal.

Additional review: memory settings and filesystem policy

Checked the native-tools consumers, memory profile initialization and real DSH filesystem adapter. Fixed three concrete compatibility differences before acceptance: numeric upper/lower bounds, zero-valued trigger/excerpt limits, and explicit undefined overriding defaults. The filesystem implementation uses path components rather than string prefixes. An actual DSH adapter test covers foreign identities and symlink changes. New seed prose is independent and only initializes an empty Git repository; existing committed records remain untouched.

Must fix before public release: the remaining bundled modules, skills and desktop executable still carry the former license. The replacement of these three dependencies does not clear that release blocker.

Reminder and seed review: default documents do not claim user preferences or supply permissions. The seed function still exits when any committed history exists. Reminder deduplication resets after repair and prioritizes conflicts over uncommitted edits. An erroneous secret-filter import was found by the suite and corrected. The old native integration seed-string assertion was replaced by self-policy checks while preserving permission/recall/queue assertions; native memory and child lifecycle tests pass. Release verdict remains blocked by the outstanding migration, not by the corrected assertion.

Transcript/process review: inspected the native thread adapter, ThreadStore ownership tests, process rings, process notices and deletion cleanup. Transcript cursors bind to the source session and full serialized snapshot. UTF-8 limits never split characters. Fixed the old over-budget-single-item behavior with an explicit retryable error. No record is skipped to make a page fit. Process batches do not duplicate flushed entries or outlive destroy. Consumers flush the final batch before destroy. Compatibility tests cover normal lookarounds/alternatives as well as the existing unsafe nested repetition guard. The static regex guard is not a complete complexity proof; that is an existing limitation retained rather than silently disabling supported regex features. Public-release verdict remains incomplete due to the remaining OMO dependency graph.

Budget/retrieval review: traced native tools -> committed corpus -> independent query strategy/selector -> prompt rendering and surfaced receipts. The corpus keeps its Git blob cache and session guards. Fixed a concrete long-line excerpt problem: a match after character 1200 now appears in the returned passage instead of an unrelated prefix. Pressure validation rejects invalid numbers rather than reporting them valid. Tests exercise strict threshold equality, Markdown-only sizes, symlink exclusion, mutation isolation of expansion arrays, CJK, surfaced exclusion and hybrid large-corpus ranking. The numeric score implementation changes intentionally with the independent algorithm; the same retrieval capabilities remain exercised. The byte estimate is approximate and uses current regular files at the existing post-integration call site, not a provider tokenizer or an assertion that every workspace file is committed.

People/compiler/guard review: inspected profile save/find/seed/compile consumers and native prompt assembly. Fixed two concrete problems before the checkpoint: invalid structured dates could be serialized but disappear from parsed observations, and fresh seed section names did not match the established card grammar. Source inputs remain unmodified; the empty-repository seed does not migrate existing user records. Compiler tests prove exact revision reads, escaped delimiters, sorted bounded references and explicit omission counts. Guard tests prove canonical foreign paths, dangling aliases, rename destinations and one warning per session. Corrected the duplicate-warning issue detected by regression. The guard is explicitly advisory for shell tools and is not advertised as OS sandboxing. Full-release verdict remains incomplete because the remaining modules, skills and desktop payload have not been cleared.

Cursor/integration review: traced the queue's canonical entries, consumed ranges, receipt acknowledgment and scheduler restart. Group boundaries include tool evidence, and failed reflection cannot advance. Integration recovery verifies the trailer, merge parents and proposal ancestry rather than trusting a text marker alone. A concrete conflicting run reuse is now rejected. Existing Git operation sentinels are checked before starting a merge; own conflicting merges are aborted, preserving prior HEAD and user data. Reviewed the caller's writer lock and validated-commit checks. Actual crash-after-landed-commit, dirty parent, conflicting files, strict-mode parent progress, grouped windows and split job receipts pass. Noncooperating external Git writers are not claimed to obey the host writer lock. Public release remains incomplete pending the rest of the dependency closure and audit.

### Hook loader and side/retention review

Traced loadClaudeHookSettings into live registration/reload and hook environment construction. Disabled installation records are ignored before validation; enabled invalid configuration fails visibly. Canonical containment also rejects symlink escapes, and duplicate default/manifest hook files load once. Existing receiving-agent project scope/reload and timeout scenarios pass. Parent context does not forward opaque provider state. Retention remains connected to DSH spill storage. Focused tests 32 passed. Whole-suite verification pending; full asset/license closure remains outstanding.

Hook loader checkpoint: whole standard suite 532/532 passed, zero failures; source/tests held unchanged. Log: /tmp/scrum-independent-hook-loader-final.log.

### X search review

Traced registration and fresh credential callback, tool execution and conditional skill registration. Replaced the protected fixture with synthetic provider data and authored a new skill. Reject invalid dates/filter combinations before networking. HTTPS X/Twitter post citations alone enter results, repeated post IDs are deduplicated, response bytes capped at 4 MiB, HTTP error body discarded. All four focused tests pass. Live xAI provider call and complete asset closure not checked here.

X search checkpoint: full standard suite 535/535 passed, zero failures, unchanged source/tests during run. Log /tmp/scrum-independent-x-search-final.log.

### File edit input envelope

Replaced hashline-contract import with fresh Scrum validation and BOM/line-ending handling. Replace/end-only ranges, nullable deletion lines, append/prepend and caller immutability are covered. Native guarded write and observed-version enforcement are unchanged. Existing late rename race continues to preserve the external destination and report already-changed source. Three focused tests pass. Hash computation/edit application in vendor/omo/tools remains unresolved; this replacement does not claim complete editor independence.

File input checkpoint: full standard suite 537/537 passed, zero failures, unchanged source/tests during run. Log /tmp/scrum-independent-file-input-final.log.

### Native tmux transport

Removed tmux-core runtime dependency. Scrum now uses argv-only Node execFile with 4 MiB output bound, finite timeout, SIGKILL on subprocess timeout and explicit failure results. No shell interprets the tmux invocation. Host-owned pane identity, restart adoption and foreign-pane safety remain in the existing manager. Six real tmux manager scenarios and two transport failure/literal-argv cases pass. Overflow and timeout have distinct diagnostics. Whole-suite verification pending. Retry is bounded and existing mutating callers explicitly request zero retries.

Tmux checkpoint: all 539 standard tests passed, zero failures. Source/test files held unchanged. Log /tmp/scrum-independent-tmux-final.log.

### Git attribution and guide

Removed attribution helpers imported from config-core; only project configuration loading remains through its existing adapter. Disabled footers produce no directive. User strings are retained as JSON-quoted text, the enabled default is newly authored Scrum attribution, and author/committer identity is unchanged. Two focused tests pass, including an actual Git commit with distinct author and committer. The git-master skill is independently authored and covers commit review, diagnosis, worktrees, conflict resolution and authorized history rewriting/publication. Other skill resources remain unaudited and this is not package-license closure.

Additional registry-contract review found that a plugin with several eligible installations must load once, and legacy version-one records must remain supported. Fixed both and added a regression exercising an ineligible project record, duplicate user records and version-one storage. Full suite rerun pending.

Git and installed-registry checkpoint: all 540 standard tests passed, zero failures. Source/tests unchanged during run. Log /tmp/scrum-independent-git-registry-final.log.

### Configuration data operations

Split JSONC parsing, nested configuration merge and model alias projection away from config-core. Uses existing declared jsonc-parser 3.3.1 (MIT), not the protected parser bundle. Merging preserves later array replacement, recursively combines records and rejects prototype pollution fields. Projection changes agent/category model references only, preserves their explicit variants and reports catalog cycles without resolving them. Ten focused scenarios pass, including cold cache/source removal, migration crash resumption and actual Git identity. Loader/view resolution and legacy migration still use config-core and must be replaced before license closure. Whole-suite rerun pending.

Configuration-data checkpoint: full standard suite 542/542 passed, zero failures, source/tests held unchanged. Log /tmp/scrum-independent-config-data-final.log. Inventory remains incomplete: loader/migration, orchestration/LSP/tool bundles, browser/desktop binaries, other skills and final distribution/runtime coexistence audit remain. Goal active; no partial release applied.

### Configuration migration, fsync diagnostics and portable tmux schema

Added root-module provenance audit; discovered three declared upstream modules outside vendor. Replaced fsync-tracker and config-portable with Scrum implementations. Preserve bounded fsync records, supported-error-only tolerance, warning drain and existing tmux defaults/bounds. Nine focused configuration/durability tests and six actual tmux scenarios pass. Mounted-volume classification is explicitly heuristic, not a claim that every external volume is a network drive.

Replaced startup migration runtime import with independent data migration. Sources include configured/OpenCode desktop user roots, profile directories, ancestor .opencode files and native legacy config.jsonc. Existing canonical configuration wins overlapping values; legacy native bracket names are normalized, including profiles. Original legacy source bytes are staged, verified and preserved in backups. Version-one journals remain readable; version-two journals bind target snapshots and source hashes. Native processes serialize through SQLite locking, released by crash. Dry-run writes no real files. Malformed/outside journals, symlinked storage and changed source/target inputs fail visibly.

Six new real-filesystem/process scenarios pass: staging interruption recovery, source edit refusal, target winner preservation, SIGKILL/restart, storage symlink escape refusal and three concurrent native startup processes producing exactly one migration/backup. Existing migration/CLI/context tests pass. Configuration loader/view and legacy provider/reasoning interpretation remain to be replaced and exhaustively compared; this checkpoint does not claim whole config parity. Mixed older binaries using the predecessor lock protocol have not been proven interoperable; release must stop old resident processes before upgrade. Standard suite rerun pending.

Migration checkpoint: all 548 standard tests passed, zero failures, source/tests unchanged during run. Log /tmp/scrum-independent-migration-final.log.

### Independent layered configuration loader

Removed the final config-core runtime import from configuration.mjs. The loader reads the preferred JSONC/JSON user file and ancestor project files, avoids duplicate canonical sources, applies base/harness/profile/profile-harness priority and supplies established factual task defaults. Unknown and invalid fields produce diagnostics consumed by the existing last-valid durable cache. Legacy native selector aliases remain usable. Union-typed custom commit footers are supported.

The validator is newly authored. Its compact constraint table contains public API field names, primitive types, choices and numeric bounds observed from the pinned public JSON Schema, structurally deduplicated into 193 nodes. No upstream descriptions, examples, prompt prose, defaults or validation implementation are imported. Contract source: https://raw.githubusercontent.com/code-yeongyu/oh-my-openagent/59d23b5c1ddc2a02210ede4cb485f88996fd02bd/assets/omo.schema.json . This is interface compatibility, not a clean-room or legal certification. Full archive/license audit remains required.

Expanded model-reference resolution to alternative lists and model profiles, inheriting canonical reasoning while preserving explicit row settings; fallback_models remain unchanged, matching observed public API behavior. Seventeen focused tests pass, including cold-cache retention/deletion, profile precedence, public type unions, numeric validation, skill reload and actual Git identity. Whole-suite rerun pending.

### Project configuration scope correction

Public API fixture observation confirmed project-local legacy files migrate to their respective project `.omo` directories, not the user directory. The independent migration now groups sources by destination, keeps each existing destination authoritative, and refuses project storage escaping its project through a symlink. A parent/child/user fixture verifies all three model assignments remain isolated. Focused migration and configuration checks passed 13/13. Preceding loader build passed standard 551/551; the corrected scope build is undergoing the standard suite. No resident deployment or completion claim.

### Gateway transport and durable notification replacement

Removed gateway-core imports from gateway.mjs and configuration.mjs. New Scrum module supplies the public OpenClaw field/default contract, scoped rules storage, revision conflict handling, listener normalization, HTTP delivery and command delivery. Current session/binding ownership, accepted-vs-received receipts, external-message correlation and persistent reply offsets remain in the native gateway. Original stored notification bodies are retained when the same committed rules revision is repeated; changed content at the same revision is refused. Minimal XML protocol structure remains for stored-data compatibility; new notification prose is independently authored.

Six additional focused tests cover configuration defaults/types, hostile placeholder values in unquoted/single-quoted/double-quoted command templates, real process-group timeout including descendants, output overflow, secret-safe failures, bounded HTTP responses, redirect refusal and same-revision stored-delivery reuse/conflict rollback. Existing wire/listener and expiry tests pass. A real SQLite upgrade fixture seeded through the prior public API, then reopened and retried through the independent implementation, preserved notification body and ID exactly, kept one delivery, and rejected changed same-revision content. Private proof: work/independent-contracts/gateway-upgrade-proof.json; no protected prompt text is included in the proof. No live third-party notification was sent.

Further configuration migration checks cover project storage symlink changes during interrupted migration and truthful project JSON dry-run previews. The preceding scope build passed 552/552 standard tests at /tmp/scrum-independent-scope-final.log. The gateway build is undergoing the standard suite. This is a component checkpoint, not whole-package license closure or a resident release.

Gateway checkpoint: all 560 standard tests passed, zero failures, at /tmp/scrum-independent-gateway-final.log.

### Independent resident memory advisor

Removed Kibitzer runtime and test imports. Scrum now owns admission/cooldown/backoff, persistent machine-wide wake leases, five scoped read-only tools, resident child reuse, fresh budgets per wake, provider usage observation, cancellation and parent disposal. Existing public tool names and configuration field names remain compatible. Prompts/descriptions are newly authored. Query expansion and committed-corpus retrieval reuse existing independent selectors.

SQLite transactions serialize lease acquisition across actual processes; owner PID/start observation recovers dead leases while retaining live owners. No expiry silently releases a running child. Unknown process identity remains occupied while PID is alive. This lease protocol is not claimed compatible with older binaries: stop predecessor resident processes before the final upgrade.

Completed focused verification: 16 tests cover existing real parent lifecycle/supersession and tool scope behavior plus three actual competing subprocesses, SIGKILL owner recovery, resident reuse with fresh budgets, cooldown counting accepted batches, token-usage exhaustion, failed startup recovery, literal file search, Unicode/secret-safe paged session text, actual native child schema validation and shared concurrent shutdown. Model remains GPT 6.1 Sol low. Provider token ceilings are observed from returned usage and abort subsequent activity; this is not a claim of exact tokenizer-based pre-billing limits. Full standard suite is running.

Ponytail caller review: native-tools invokes offer on genuine human messages and completed tools; kibitzer-host binds each delivery to the captured human query and committed revision, and abort/disposal cleanup remains parent-scoped. Session projection now removes opaque reasoning/image/tool payloads from the advisor's read-only conversation view; primary DSH session history is untouched. Canonical path/traversal and leaf no-follow checks are filesystem checks, not an operating-system sandbox against an adversarial process racing parent-directory changes. No live paid model was invoked in this checkpoint. Orchestration/LSP/tool bundles, browser/desktop assets, skill resources and final distribution/coexistence verification still remain. No license relabel or resident deployment.

Memory-advisor checkpoint: full standard suite 567/567 passed, zero failures, source/test files held unchanged. Log /tmp/scrum-independent-advisor-final.log. Runtime references to config-core, gateway-core and kibitzer are absent from current non-vendor/non-work source and tests. Inventory retains complete=false: remaining orchestration, LSP/tool, desktop/browser assets, skills and full distribution/runtime coexistence gates are not yet closed. Goal remains active.


### Independent keyed workpool checkpoint

Scrum now supplies its own keyed JSON queue, atomic SQLite-serialized publication, worker generations, assigned-message protocol, idle observation, cancellation, confirmed cleanup and aggregate acknowledgment. Root runtime no longer imports vendor/omo/workpool.mjs. New prompt text is independently authored; version-one pool records and aggregate data shape are retained. Dead unconfirmed admissions are marked uncertain rather than replayed. Explicit parent stop suppresses aggregate notification and requires resource cleanup before the controller can close. Other-parent resources are preserved.

Native worker grants are persisted and reapplied on SDK resume. Unknown tool names and grants exceeding read-only roles are rejected before child creation. Empty grants permit only workpool result reporting. This support covers named registered tools, not arbitrary parent JavaScript kernel closures. Machine-wide execution quotas, real predecessor-upgrade/crash-boundary tests and paid-model coexistence acceptance remain open; this checkpoint does not establish them.

Ponytail caller review followed ThreadStore create/send/interrupt, native SDK create/resume, root stop/dispose and controller completion gates. Read access rejects a symlinked pool storage directory as well as symlinked record leaves; these checks are not an OS sandbox against concurrent malicious directory replacement. Twelve focused tests pass, including atomic conflicting-key rollback, parent-stop suppression, worker reuse and stale/conflicting result handling, failed aggregate restart, preserved results after host release, scoped dead-worker recovery and native grant persistence/role denial. Standard suite passed 570/570 with no failures, skips or cancellations and unchanged source/tests throughout the run: /tmp/scrum-independent-workpool-full.log.

Protected vendor files are still retained privately; packaging and provenance closure remain incomplete. No resident deployment, license relabel or GitHub publication occurred. Goal remains active.


Workpool follow-up: fourteen focused tests pass. Three actual competing Node processes retained all 36 committed mutations and revision increments. Captured-turn tests check queue-entry changes, generation changes, idempotent recovery and denial of a forged acknowledgment lacking a matching durable message hash. Review found and fixed that last acknowledgment gap. The earlier 570-test result applies to the preceding build; the revised build is undergoing a new standard run. Remaining gates above stay open.

Workpool revised checkpoint: full standard suite passed 572/572, zero failures/skips/cancellations; final source/test build remained unchanged during execution. Log: /tmp/scrum-independent-workpool-final.log. Inventory has 56 rewritten assets and 25 remaining reference entries, complete=false. Further workpool quota/kernel parity, actual predecessor upgrade and SIGKILL admission tests remain required before whole-feature acceptance. Next runtime replacement is DAG orchestration and HardTackle toolkit, followed by LSP/editing/browser/desktop/skills and complete distribution/runtime coexistence audit. No deployment or license closure.


### Independent DAG engine in validation

Implemented new Scrum modules dag-compiler, dag-store and dag-engine. DAG runtime and four associated test files now import independent/dag-engine.mjs. Graph compiler returns dependency waves, critical paths and transitive bottlenecks, validates route/input data and detects cycles without recursive traversal. Durable checkpoint/event/result paths retain the version-one wire/storage shape; a SQLite transaction serializes synchronous writers, JSON publication uses temporary-file/fsync/rename, and incomplete JSONL tails refuse further writes rather than fabricating receipts. Symlinked storage and path traversal are rejected.

Scheduler binds owner fingerprints before admission, forwards completed dependency results as input data, gates downstream admission on confirmed results, preserves late-admitted child bindings on suspension, waits for pending admission cleanup on cancellation, refuses vanished workers, and explicitly retries failures with a new generation. Amending a predecessor invalidates its dependent results. DSH retains child sessions and fixed model selection. Native cleanup still gates final controller completion.

Fifteen focused tests passed across compiler/store/native lifecycle/recovery and added cancellation/suspension admission boundaries. A real predecessor public-API fixture was reopened by the new manager: checkpoint content and run ID were preserved, the existing definition was reused without another run, and amendment retained history with two events. No protected prompt body was inspected or copied in that fixture. Standard suite is running; this checkpoint is not complete DAG acceptance. Retention pruning, global scheduling capacity, concurrent live scheduler ownership, actual SIGKILL publication/admission recovery and broader route/definition contract parity remain open. Protected assets still retained privately; no deployment, license relabel or publication.

DAG initial checkpoint: standard suite passed 580/580, zero failures/skips/cancellations with source/tests unchanged during execution. Log /tmp/scrum-independent-dag-first.log. Inventory updated to 59 rewritten assets and 20 remaining reference entries, complete=false. DAG component limitations listed above still require implementation and acceptance; green existing tests do not close those requirements. Goal stays active.

DAG retention follow-up: added configured retention with public default seven days, terminal-only pruning and live-lease preservation. Matching key receipts and result/event/checkpoint paths are checked before removal; symlink/nonregular result content causes refusal before destructive writes. Sixteen DAG-focused tests now cover the added retention scenario. A fresh standard run is live at /tmp/scrum-independent-dag-retention.log; the earlier 580-test result remains scoped to the previous build. Native runtime is still private development, with live scheduler lease admission/global limits and crash tests remaining open.

DAG retention checkpoint: full standard suite passed 581/581, zero failures/skips/cancellations, source/tests unchanged during execution. Log /tmp/scrum-independent-dag-retention.log. All source SHA values recorded. Remaining DAG ownership/concurrency/crash acceptance, command/toolkit/LSP/browser/desktop/skill replacements and final package/coexistence audit are still required. Goal remains active.


### DAG scheduler ownership and command replacement

Read-only DAG commands now use independent/dag-commands.mjs; native-task-commands no longer imports the protected bundle. Session-scoped list/detail renders wave/dependency/status/route/model/error data, critical paths and bottlenecks with control-character filtering. Foreign-run details are refused. Existing four command tests pass.

The scheduler acquires a persisted unique token and process PID under the store transaction before starting or observing any work. A different token or uncertain legacy running owner is refused; explicit suspension releases the token. Cancellation also verifies ownership before interacting with child sessions. Confirmed crash pause removes both the legacy PID lease and the new token. Runtime host PID receipts are written only after successful acquisition; scheduler observers register only after acquisition, preventing failed claimants from becoming controllers.

Added two meaningful ownership tests: two same-process schedulers cannot duplicate admission/cancel another owner, and an actual second Node process is refused while the first owns the run. SIGKILL of that actual process permits confirmed pause, and recovery marks the unconfirmed scheduled node failed rather than repeating admission. Existing native suspend/resume and parent isolation scenarios remain passing. Eighteen DAG-related and four command-focused tests now exist; latest affected subset thirteen tests passed. No claim of automatic replay of uncertain work is made.

The standard suite is live at /tmp/scrum-independent-dag-ownership.log. Global execution limits, event/checkpoint crash reconciliation, full route/definition parity and final distribution/coexistence gates remain open. Protected private snapshots/assets remain; no license relabel or resident deployment. Inventory complete=false; goal active.

DAG ownership/commands checkpoint: standard suite passed 583/583, zero failures/skips/cancellations; source/test files held unchanged throughout run. Log /tmp/scrum-independent-dag-ownership.log. Root provenance audit now explicitly includes unresolved ultrawork request masking and memory-recall changed-blob adaptation, in addition to desktop build provenance. These are part of the full replacement scope, not excluded. Next step is independent HardTackle toolkit/request masking, then root memory extraction and remaining tool/desktop/browser/skill assets. Goal active, package closure unproven.


### Independent HardTackle request visibility and goal toolkit

Root ultrawork now imports an independent caller-text scanner. It preserves UTF-16 offsets/CRLF, ignores inline-code/fence/quote/control regions and retains human-only activation/explicit stop gates. Existing four mode/command tests and two new scanner tests pass. The declared upstream masking implementation is removed; conditional HardTackle skill resources still require separate provenance closure.

Root ulw-toolkit now imports independent/goal-toolkit.mjs, which supplies the ten public operation names/method aliases, scoped version-one goal storage, newly authored default criteria and sequential acquisition, evidence/checkpoint/blocker recording, steering and goal addition. Essential evidence and review blockers gate completion. Later criterion failure invalidates completed status. Creation refuses overwriting an existing plan. Storage serializes actual competing processes with a SQLite lock, rejects symlinks/path traversal and publishes fsynced JSON via rename. Ledger/brief are derived projections; a durable pending marker and pending aggregate prevent overall completion when projection publication fails. Explicit subsequent acquisition reconciles pending projection without losing evidence.

Four additional toolkit tests cover missing evidence/blockers, regression after completion, session isolation/symlinks/invalid criteria, actual projection failure/recovery and three real writer processes adding 24 goals with 25 unique revisions including the initial plan. Existing host-owned toolkit test passes. A predecessor public-API fixture was read through the new toolkit with original plan/goal IDs/criteria preserved exactly, and new acquisition succeeded; no generated protected criterion text was printed or copied into distributable source.

Standard suite running at /tmp/scrum-independent-goal-toolkit.log. Full argument/status parity, crash publication recovery, cancellation/goal budget/steering semantics and native mode integration remain for broader final acceptance; registration and green focused tests are not full goal completion. Root memory changed-blob extraction, remaining tool/LSP/model/desktop/browser/skill assets and final package/coexistence audit remain open. No license relabel, publication or resident deployment. Goal active.

HardTackle goal-toolkit checkpoint: standard suite passed 589/589, zero failures/skips/cancellations with source/tests unchanged throughout. Log /tmp/scrum-independent-goal-toolkit.log. Inventory now 62 rewritten assets and 18 remaining reference entries, complete=false. Goal remains active. Next independent replacement is root memory committed-corpus extraction; remaining LSP/edit/tool/desktop/browser/model/skill assets and complete packaging/coexistence gates are still required.


### Independent committed memory corpus

Root memory-recall no longer contains the declared upstream changed-blob extraction code. New independent/committed-memory-corpus.mjs reads an immutable commit tree through Git's formatted NUL records and batch-command contents protocol, with explicit object IDs, header ordering, byte lengths, terminating separators and trailing-data checks. Its blob-ID cache avoids repeated reads for unchanged or newly duplicated content; path/ID cache preserves existing document object identity. Caches publish only after full validation; malformed responses leave the last valid snapshot intact. Worktree files are never opened. Regular committed Markdown is selected; system/ and symlink blobs remain excluded.

Eight focused tests passed: two new real-Git corpus cases plus existing CJK recall/query isolation/surfacing/remote-sync acceptance. They prove dirty worktree exclusion, immutable old snapshot, committed update, unchanged object reuse, removal without another blob read, same-blob new path reuse, Japanese/tab/newline filenames and corrupt/truncated reply retry without advancing caches. Invalid non-object revisions are rejected before Git execution. Root memory history/projection and independent selector behavior remain connected.

Standard suite live at /tmp/scrum-independent-memory-corpus.log. No embedding or semantic-recall claim is introduced. Root provenance audit records this specific declared algorithm replacement; marker absence is not general proof of independence. Remaining editing/LSP/AST/model/desktop/browser/skill assets, broader private source audit and final package/coexistence acceptance remain required. No license relabel, publication or resident deployment; goal active.


Memory-corpus checkpoint: full standard suite passed 591/591, zero failures/skips/cancellations; source/tests held unchanged during run. Log /tmp/scrum-independent-memory-corpus.log.

### Independent conditional rules

Root context now imports newly written rule discovery/YAML parsing/scoped glob matching instead of the protected tool bundle. Existing js-yaml and picomatch dependencies provide standard parsing/matching. Discovered project .claude/rules and .cursor/rules Markdown, .github/instructions/*.instructions.md, single copilot-instructions.md and home .claude/rules retain public source metadata. Search runs from the observed target's canonical directory to its canonical workspace root; missing target tails preserve canonical ancestors. External symlink targets are skipped. Always-apply and applyTo/globs plus explicit negative patterns are supported; plain descriptive prose alone is not automatically injected.

Two new tests cover glob/exclusion/default semantics, malformed frontmatter, nested/global/single-file discovery and symlink scope, alongside existing actual context reload/command/agent isolation tests. Affected focused subsets passed 17 and 16 tests. Standard suite live at /tmp/scrum-independent-conditional-rules.log. Only the conditional-rule entry points are replaced; other functions in vendor/omo/tools.mjs remain open. Inventory complete=false and goal active. No release or license relabel.

Conditional-rule checkpoint: full standard suite passed 593/593, zero failures/skips/cancellations, with source/test files unchanged during execution. Log /tmp/scrum-independent-conditional-rules.log. Inventory 64 rewritten assets, 17 remaining reference entries, complete=false. Next remaining runtime bundle work is independent hash-anchored edits, AST/LSP tool adapters and model/desktop/browser/skill assets; full private origin audit, package pruning and DSH/Dashboard acceptance still required. Goal active.


### Independent hash-anchored edits

Native read/edit and DSH read decoration now use independent/hashline-edits.mjs; affected tests import it too. The native multi-file/version-checked mutation and rename adapters are unchanged. The independent engine validates every input against the original document before mutation, rejects stale/out-of-range/reversed anchors and overlapping replacements or consumed insertion anchors, applies original-coordinate changes, keeps exact-duplicate replacement last-wins and repeated insertion ordering, supports deletion/empty creation/multiline content/trailing newlines. Two new engine tests plus native real DSH rename-race/read-decoration/context acceptance passed nineteen affected tests.

Compatibility change is explicit: new read IDs use S plus twelve SHA-256 hexadecimal characters over exact line content. Historical unversioned two-letter anchors are refused with an instruction to reread; protected hash implementation is not retained as a fallback. This changes transient anchor IDs, not saved files, user conversations or task records. Native descriptions now state versioned references and reread policy rather than falsely claiming OMO hash interoperability. Before resident release all agents must obtain fresh reads; package/runtime acceptance must exercise that migration. This checkpoint does not claim unchanged historical hash bytes or fully closed tool-bundle parity.

Standard suite live at /tmp/scrum-independent-hashline.log. Remaining AST/LSP functions and their schemas/descriptions still import the protected tools bundle. LSP, model assets, browser/desktop/skills, private provenance audit and package/coexistence acceptance remain open. No release or license relabel; goal active.

Hashline checkpoint: full standard suite passed 595/595, zero failures/skips/cancellations, source/tests unchanged throughout execution. Log /tmp/scrum-independent-hashline.log. Inventory 65 rewritten assets and 12 remaining reference entries, complete=false. Transient anchor migration remains explicit; final DSH/Dashboard acceptance must reread before edit. Remaining AST/LSP and assets/package audits are required; goal active.

### Independent AST adapter

Native AST tools and actual edit acceptance now import independently written independent/ast-tools.mjs rather than protected AST exports. The existing AST-grep OSS binary remains provisioned by ast-runtime. Searches, rewrite previews and inline/file YAML scans parse newline JSON, preserve UTF-8 byte offsets and one-based line metadata and normalize captured variables. No update-all/direct-write option is issued; host version-checked application remains authoritative. Scope violations and non-array glob/ignore options fail before execution. Match and byte truncation mark incomplete previews and cannot authorize editing. Timeout/cancellation terminate the detached executable group and await closure. Counts include all observed files even when returned matches are limited.

Five focused tests pass, including three new cases with the actual installed AST executable: Unicode search/rewrite and inline/file scans, zero matches, file-count and payload truncation, refused truncated apply, invalid paths/options and real timeout/cancellation. Existing stale-content/version-guard acceptance also passes. Full suite running /tmp/scrum-independent-ast.log. Full optional AST argument parity remains for final feature audit; remaining LSP exports in the tool bundle are explicitly retained for later replacement. Inventory complete=false; no resident deployment, publication or license relabel.

AST checkpoint: standard suite passed 598/598 with zero failures/skips/cancellations and source/tests unchanged throughout execution. Log /tmp/scrum-independent-ast.log. Inventory 66 rewritten assets, 11 remaining reference entries, complete=false. LSP/tool schemas, model assets, desktop/browser/skills and final provenance/package/coexistence gates remain required. Goal active.

### Independent LSP transport and editing adapter

LSP mutation and native query registration no longer import either protected LSP bundle. New lsp-client provides scoped request contexts, explicit user/project JSONC server configuration, per-workspace/configuration client reuse and independently authored stdio Content-Length JSON-RPC. UTF-8 byte framing, bounded message/header sizes, initialization/document synchronization, cancellation/timeout, server configuration replies and rejected server-initiated workspace edits are covered. Shutdown closes child groups. New lsp-text-edits uses UTF-16 coordinates, validates every range before mutation, preserves CRLF and refuses surrogate splitting and overlapping edits. Existing DSH resource-order/version guards remain authoritative.

Actual TypeScript format, rename, definition/reference/symbol queries and running status passed; existing real resource create/edit/rename/delete acceptance passes. New transport fixture tests byte framing, remote-write refusal, updated document versions, cancellation/timeout and oversized-frame failure. Installation decision storage keeps predecessor object/decision/decidedAt records, serializes writers with SQLite and publishes fsynced atomic JSON. Existing fields survive; disabled capability and final symlink writes are refused. Ten focused tests passed across existing/new groups, plus two actual native query/decision tests. The initial package-discovered automatic TypeScript server caused unrelated CLI formatter fixtures to retain a client; explicit configured-server behavior fixes that interim issue rather than disguising a completed builtin registry.

Remaining LSP parity is explicit: builtin language/server registry, authorized installation execution, directory diagnostics, complete diagnostic notification waiting/filtering and all upstream result-shape/config/reload behavior still require investigation and implementation. Native code is independent but this does NOT close feature parity. Independent transport currently loads only explicitly configured servers. Do not release as complete or silently drop those gates. Full standard suite running /tmp/scrum-independent-lsp.log. Inventory complete=false, private protected assets remain, no resident deployment or license relabel. Protocol reference: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/ .

LSP checkpoint: full standard suite passed 603/603 with zero failures/skips/cancellations and unchanged source/tests throughout. Log /tmp/scrum-independent-lsp.log. Inventory 69 rewritten assets, six remaining reference entries, complete=false. These counts measure replaced source references, not whole-feature completion. Remaining LSP parity and client lifecycle admission/reaping, protected static assets and private root origin audit remain explicit completion gates. No resident update or license relabel. Goal active.

LSP lifecycle/query follow-up: public black-box query details established filePath/line/character, locations, references/totalReferences/truncated, symbols/totalSymbols/truncated and prepare-rename result wire keys. Independent query tools now retain those keys in the standard content/details/isError envelope with newly rendered JSON text, not protected rendering prose. Actual TypeScript type-error diagnostics now wait for publication and surface TS2322; absent publication stays pending instead of pretending no errors. Versioned old diagnostic packets cannot satisfy a current-version wait, and unversioned packets explicitly lack version verification. Closed clients are removed from the pool; inactive clients shut down after the configured idle interval (default 60s), while active callbacks prevent reaping. New actual child-process idle cleanup test proves removal and process termination. Cancellation and timeout remain usable for subsequent requests. Standard suite running /tmp/scrum-independent-lsp-lifecycle.log. Builtin registry/admission, automatic installation, directory aggregation, complete config/result parity and broader goal gates remain open.

LSP lifecycle checkpoint: standard suite passed 604/604, zero failures/skips/cancellations, unchanged source/test files throughout. Log /tmp/scrum-independent-lsp-lifecycle.log. Independent source hashes match the inventory. Remaining builtin registry/install/directory/complete parity gates are not closed by these tests. Goal active; no release, publication or resident deployment.

### Separately licensed LSP registry and scoped package installation

New vendor/lsp-registry retains selected Apache-2.0 Mason Registry package metadata at ee10e9db59f13054eea925042cae6d1df461ec25 and Apache-2.0 nvim-lspconfig launch references at c59fc922f718fa055f69f5f3bc888f23211571eb. Both license texts, transformation NOTICE, original preferred inputs and source hashes are retained. JSON conversion/host integration changes are explicitly attributed to MaaS Creative. These are appropriate separately licensed OSS replacements, not a claim that imported data is independently authored. Executables are not bundled; their individual licenses are separate and recorded in recipes.json. Source URLs: https://github.com/mason-org/mason-registry and https://github.com/neovim/nvim-lspconfig .

Public API observation established 42 prior builtin IDs and extension lists. The newly integrated catalog covers those IDs, bash/terraform aliases and 35 package recipes. Configuration reload merges explicit overrides, and installed executable detection selects enabled servers by priority; custom command overrides do not use another cached executable. Language IDs include React, Ruby/C#/F#, Julia and shell variants; Dockerfile matches without an extension. Status again lists the builtin/configured catalog alongside live snapshots, rather than an empty list before any process starts.

The new independent installer requires both host capability and the exact server's persisted allowed decision, rechecks the decision after acquiring its writer lock and stages installation in a dedicated folder. An in-process queue plus per-server SQLite lock prevents duplicate publication. Pin/recipe hashes and regular-file scoped executable receipts enable reuse. Existing incompatible installations are never overwritten. Failed installation removes its own staging directory; cleanup failure still releases the lock. Npm, Python virtual environments, Go and dotnet tools have explicit manager adapters. Relocated Python script entry points run through their copied virtual-environment interpreter; native Python wheel programs run directly. Secrets in installer output are filtered.

Four new registry/installer tests and existing real transport/query/resource/formatter tests passed. Fake CLI formatter scenarios now explicitly disable LSP so their version-race/timeout tests still exercise the intended CLI path when a builtin server is installed. Real network acceptance installed typescript-language-server@6.0.1 plus the pinned TypeScript companion in a temporary private store, used the installed server to return one definition/two references, and reused the same receipt. Evidence: work/independent-lsp/npm-live-proof.json; log /tmp/scrum-lsp-npm-live.log. The temporary installed package was removed after verified shutdown.

Full standard suite running /tmp/scrum-independent-lsp-registry.log. Remaining gates are explicit: archive/generic/gem/opam/system-toolchain installers, root-marker/advanced server configuration and dynamic capabilities, directory diagnostics, cache-version upgrades and crash/orphan installation recovery, full per-server/API parity, unsupported Razor-specific requests, and final private origin/asset/package/coexistence audit. Installation of every ecosystem or server has NOT been demonstrated. No resident deployment, publication or license relabel. Goal active; inventory complete=false.

### LSP registry and installer verification

- Full standard regression run: `/tmp/scrum-independent-lsp-registry.log`, 608 passed, zero failed/cancelled/skipped (86.37 s).
- Actual isolated npm language-server installation and definition/reference queries passed; evidence: `work/independent-lsp/npm-live-proof.json`. This does not establish real acceptance of Python, Go or .NET installers.
- Added `lsp-registry-build.mjs --check`: validates every pinned source hash and reproduces all 35 selected recipes using shipped Apache-2.0 inputs, without temporary directories or network access. Check passed.
- Remaining installation families, process crash cleanup and wider LSP parity remain open. Overall completion remains false.

### Independent desktop replacement components

The independent Peekaboo adapter and native Swift emergency-stop listener passed six focused regressions and actual capture/global-hotkey/host-refusal checks. See `docs/independent-desktop-replacement.md` for evidence and remaining API/sandbox/integration gates. The active protected desktop implementation remains unchanged until those gates pass.

### WASM sandbox review

The sandbox uses independently authored QuickJS host bindings rather than Node vm. Focused tests now explicitly prove heap exhaustion (not merely CPU timeout), deny host constructor escape and Node globals, enforce read-only input, settle unawaited native work, and forward aborts. Actual screenshot capture through the WASM sandbox passed. The screen-capture adapter was corrected to forward the sandbox's second-argument abort/timeout options; otherwise cancellation would have been lost. Full desktop API, aggregate capture memory bounds and public output compatibility still need acceptance before runtime replacement. No licensing completion claimed.

Full standard regression after WASM dependency/bindings and desktop component tests: `/tmp/scrum-independent-desktop-sandbox.log`, 618/618 passed, zero failed/cancelled/skipped (78.09 s). This establishes regression safety of the new components, not completion of protected desktop replacement or overall publication audit.

### Native observation and worker isolation

A real infinite loop exposed that main-thread WASM execution could delay native stop delivery. The VM now runs in an owned worker, with shared atomic interruption and host-side read-only enforcement; actual hotkey interruption passed (3 ms after receipt). Independent native inventory preserved all legacy snapshot IDs, and AX references resolved after correcting the focused-element lookup. Local Peekaboo execution avoids unrelated bridge process lifetimes. Frame coordinates are checked against their original display geometry. Fifteen focused tests pass; session-controller integration and actual input remain unproven, so protected desktop removal is still blocked on implementation/acceptance work, not declared complete.

Full standard regression for native observation/AX methods, worker isolation and frame-coordinate changes: `/tmp/scrum-independent-desktop-observation.log`, 623/623 passed, zero failed/cancelled/skipped (85.46 s). Subsequently the independent preferred-source build test passed in 4.90 s: clean temporary destination, SHA-256 source/binary checks, real native stop key receipt, permission query, and staging cleanup. The final standard run must include that additional build test.

## Desktop controller review — 2026-10-11

What this change does: the new desktop controller owns input leases, native stop,
worker execution and audit records. Background actions use fresh captured window
receipts and do not activate the target window.

Reviewed the controller, worker RPC argument boundary, build loader, CLI adapter
and the actual owned AppKit acceptance flow. Fixed an extra positional argument
that could shadow trusted cancellation options; added a regression that verifies
no backend call occurs. Fixed background drag target arguments and added routing
and geometry-change regressions. Corrected startup capability reporting to read
the live listener state rather than always declaring the stop path available.

The real acceptance passed click, type, key input, scroll and drag with foreground
preserved. Focused regressions passed 15/15; a separate loader integrity regression
passed source mismatch, binary mismatch and symlink refusal. Full standard tests
are being collected separately. This does not approve the protected root desktop
runtime for publication. Capture parity, dependency notices, root replacement and
combined release acceptance remain open.

Verdict: retain release gates before switching and shipping the root runtime.
Not checked: full capture/API parity and final distribution license closure.

The completed final standard run for this controller revision passed 631/631,
zero failures, cancellations or skips (90.826 s). The initial run failed one
obsolete capability assertion expecting background input to be unavailable;
the expectation was updated after actual background-input acceptance and the
entire suite rerun. Evidence: `/tmp/scrum-independent-current-tests.log`.

## Scoped desktop API and command lifetime review — 2026-10-11

What this change does: the desktop root now uses independent WASM handles,
Swift AX/capture observation and guarded native commands. Protected desktop
assets are excluded from the draft package. Resident deployment is unchanged.

The review traced guest handles through read-only RPC validation, session leases,
CLI snapshots and native AX requests. Fixed a query-field override that could
redirect a read-only request into `raise`. Fixed global click fallback that could
hit an occluding window; it now uses an owned window capture receipt. Added
regressions for both cases and uncertain input results without automatic replay.

A real parent-death test then demonstrated an orphaned command heartbeat after
SIGKILL. Added independent Swift preferred source for a native lifetime guardian:
parent stdin EOF, private process group, descendant cleanup and bounded force-kill.
The child cannot inherit the guardian's control descriptor. Actual parent death,
SIGTERM-ignoring child and grandchild, normal-exit descendants, and command timeout
all passed. Actual background input and scoped AX tests passed again through this
new command path. The full revised standard run is being collected separately.

Verdict: do not ship the whole package until remaining inventory, dependency
license and combined acceptance gates pass.
Not checked: full historical/default-limit parity, all distribution licenses,
and unambiguous element identity across replacement of indistinguishable nodes.

## Independent bundled instruction replacement

HardTackle, handoff, refactor and review-work were independently authored from the current Scrum execution APIs and user acceptance conditions, without reading or reusing the previous instruction bodies. Private originals remain under work/independent-skills/previous and are outside the npm file list. The HardTackle injection and native skill-provider tests passed 6/6 after replacing a stale literal-heading expectation; command recognition, human-origin filtering, stop persistence, runtime control and source precedence checks remain unchanged. Full functional acceptance against all prior skill capabilities is pending; this batch does not close the overall migration gate.

Distribution review: the actual npm file list now retains only vendor/omo/LICENSE.md and vendor/omo/opengateway-models.json. Literal relative module and URL references among distributed JS modules have no missing targets. This is a dependency-list check, not proof of legal clearance or browser/runtime parity.

## ast-grep skill source audit

The separately published ast-grep-skill repository has MIT licensing at pinned commit 3148c69c370a51afb661b9f37879c0bd7cf0cc3b. Raw authoritative source bytes match 9 of 17 local files (excluding local SOURCE). Seven local files differ, and local AGENTS.md does not exist at that upstream commit. Therefore the entire local directory is not cleared by its MIT license alone: differing files need independently authored replacements or a verified appropriately licensed source. Exact matching files are recorded individually in work/independent-contracts/ast-grep-skill-source-audit.json. No full behavior or package clearance is inferred.

The first whole-suite run after instruction replacement exposed omitted refactor scope/strategy and authoritative handoff sections. Independent instructions now document file/module/project scope, safe/aggressive strategy, codemap/LSP/AST caller checks, rollback, verbatim requests, explicit constraints and the concise ten-file index. Model and authorization precedence are explicit. The existing builtin-contracts test remains unchanged; all seven relevant contract/provider/mode checks passed. A new full suite is running in /tmp/scrum-independent-skills-contract-final-tests.log; its result must be inspected before acceptance. The earlier failed run is not release evidence.

## MIT AST skill replacement acceptance

Replaced the modified ast-grep skill files with preferred source fetched from the separate MIT repository at the pinned commit. Local AGENTS.md, absent upstream, was moved out of the distributed directory into private evidence. Independently authored changes fix variadic paths after interspersed argparse options and pin both installer defaults to the existing 0.45.3 CLI. The upstream POSIX smoke suite passes. A new standard regression test uses the installed CLI with a temporary Japanese-text fixture: search succeeds, preview leaves bytes unchanged, an unknown option is rejected without mutation, and explicit apply changes only the matched call. Native skill precedence/loading tests also pass (3 focused tests). Windows installer execution and the broader skill behavior equivalence remain pending; MIT source attribution and source hashes are retained in skills/ast-grep/provenance.json.

The pre-AST-change full run passed 641 tests, zero failures, cancellations or skips in 96.203 seconds (/tmp/scrum-independent-skills-contract-final-tests.log). A new frozen run is required for the subsequent AST replacement.

## Browser runtime rebuild from separate MIT preferred source

Cloned and checked out omowright commit 293ca5002cbd4c8b0c104c5934683385ef7e0d3a from its separately MIT-licensed repository. Shipped preferred sources now reside in vendor/browser-independent, with upstream LICENSE and package metadata. Independently authored browser-runtime-build.mjs records all 150 source/dependency inputs, their hashes, build dependencies and output hashes. The page bundle matches the prior distribution exactly. The host bundle differs because the explicit build recipe and resolved MIT dependencies (ws 8.22.0, zod 4.6.5, esbuild 0.28.2) differ; equivalence is tested rather than inferred. The current runtime directory contains this rebuilt bundle and corresponding notices. A standard test reproduces all output hashes from shipped source and loads BskIpcClient. Thirteen browser ownership/stop/reconnect/image/tracked-intent regressions pass. Thirteen upstream IPC/export tests also pass against the pinned source. Broader browser skill wrappers and instruction bodies remain separately unresolved. Resident deployment, real connected-browser acceptance and full release clearance remain incomplete.

The preceding frozen AST-skill full suite passed 642/642, zero failures/cancellations/skips in 94.440 seconds (/tmp/scrum-independent-ast-skill-final-tests.log). A new frozen run covers the subsequent browser runtime rebuild.

## Browser instruction and reference replacement

Replaced the browser skill instructions and local routing references with independently authored descriptions of the actual Scrum browser_connect/browser_execute APIs, permission boundaries and mode-specific Playwright versus OmOWright bindings. Preserved the separate upstream MIT skill, TOOLS and six full reference documents under their own names and retained LICENSE.omowright. Original local docs are private evidence only. ATTRIBUTION explicitly identifies unresolved scripts rather than assigning them a blanket MIT license. Native skill-provider and runtime reproducibility checks passed 3/3 after this documentation change. The preceding frozen full suite passed 643/643, zero failures/cancellations/skips, in 98.418 seconds (/tmp/scrum-independent-browser-rebuild-final-tests.log). Package audit found no missing preferred-source inputs and all runtime license files present. Full skill behavior, wrapper scripts and release integration remain incomplete.

## Independent browser diagnostic and onboarding entry points

Replaced browser-doctor.mjs and browser-install.mjs with independently authored, import-inert entry points calling the separate MIT runtime public bskDoctor/bskOnboard APIs. A shared independent option parser rejects unknown arguments, invalid browser identifiers and out-of-range CLI waits. Canonical is-main checks work through symlinked workspaces. Importing either module and requesting help produces no diagnosis, installation or wait. Two targeted standard regression tests pass; installation delegation was tested through an injected public API fixture, without changing the host browser or OS permissions. Real diagnostic execution reports CLI installed, daemon running and one connected browser with ready=true (/tmp/scrum-independent-browser-doctor.json). The remaining guard/loader, actual onboarding mutation and full release integration are not cleared by these tests.

## Independent browser loader

Reimplemented the loader from observed public contracts: usable OMOWRIGHT_ROOT override, bundled runtime fallback, package resolution, entry/omowright return fields and policy wrapping. Explicit native hosts and an existing kernel tool namespace remain supported. Nine loader/CLI/tracked-intent tests pass; usable overrides cannot bypass connected-mode policy. Invalid directory overrides fall back to the bundled runtime. The engine guard remains the prior implementation and is not declared independently replaced. Public behavioral probes establish BskSession click approval: Allow dispatches, denial and pending replies produce user_declined without dispatch. Error constructor codes and engine choices were observed without copying implementation source. Wider guard parity, source clearance and end-to-end release acceptance remain pending.

## Browser guard staging: transport bypass regression

The separately authored guard remains staged and is not the resident or active loader guard. Review of the MIT transport API found that forwarding `callWithHandle` or `resolveSocket` would bypass the session confirmation and scope checks. Those methods, cancellation, and unrecognized raw transport methods now refuse access; guarded `call` remains available. The real BskSession fixture verifies that direct handle and socket access cannot reach the injected transport.

Ten focused tests passed across the staged guard, independent loader, and independent CLI. Space, Tab, and Escape no longer receive an unrelated submission confirmation. Enter remains conservatively confirmed pending a compatible editable-field newline implementation. This is an outstanding acceptance requirement, not a completed guard replacement. Subscription labels now receive the irreversible action policy. Production activation, actual connected-browser verification, and broad regression remain pending.

The expanded browser run passed all 24 tests, including monitor hardening, tracked intent, stop ownership, native image return, and reproducible runtime build. This does not prove staged guard activation: the production loader continues to import the existing guard until its remaining acceptance requirements are closed. Evidence: `work/independent-browser/guard-staging-audit.json`.

## Browser guard editable Enter and export contract

The independent guard now edits an editable textarea selection directly for an unmodified Enter, emits an input event, and does not send the native submission key. Read-only, disabled, single-line, reference-targeted, and modified key paths retain confirmation rather than silently modifying a field. The evaluation is routed through the existing owned session after status and acting-state checks. A VM test verifies the independently authored DOM expression, and a real BskSession fixture verifies the successful reply does not dispatch tool.press. The expanded browser suite passed 26 tests. A further guard run passed 9 tests including every observed public export classification (except connectBrowserSkill, which has separate mode and stop tests). The public classification facts are retained in test-fixtures so tests do not depend on private research directories.

This closes the basic editable-textarea regression but not the actual connected-browser acceptance or all rich editor behavior. The active loader guard and resident version remain unchanged.

## Browser guard actual connection and worktree activation

Actual BrowserSkill connection to Chrome passed the local-page proof: textarea Enter produced ab plus newline, the declined Send action did not execute, and stopped-session snapshot was refused. Evidence: work/independent-browser/guard-live-proof.json. The original guard is backed up privately; the production-path worktree file now re-exports the independent guard. Resident installation has not changed. Loader checks exposed synchronous-versus-async refusal and message-case compatibility issues; both were fixed in implementation and the 11 focused guard/loader tests now pass. Full regression is running and is not yet claimed successful.

The final active-browser-guard regression completed with 656/656 successful tests and no skipped or cancelled cases. This run precedes the next lifecycle-version replacement. The independently authored version comparator matches 225 observed public input pairs and compares integer components without floating-point precision loss. Package update now uses it; the original comparator is excluded from npm distribution but retained as private historical evidence. The actual npm update fixtures have been adjusted to ship the new dependency rather than the inactive original. Their full update regression is running.

Version comparison and actual npm update acceptance passed all 8 tests, including activation, rollback, integrity and symlink rejection, process-lease deferral, and executable-bit retention. Evidence: work/independent-lifecycle/version-audit.json. Coverage, drift, and Git helpers in vendor/lifecycle remain unresolved and active; this is not completion of the lifecycle family or whole migration.

## Lifecycle Git and refresh detection

Independent Git aggregation and refresh detection are implemented in independent/lifecycle-git.mjs and independent/lifecycle-drift.mjs. The onboarding caller now imports them. Public black-box observations established the committed change/current line-count distinction, stale commit behavior, same-head suppression, and 30-commit/15-percent touched, 25-percent churn, 90-day refresh thresholds. Nine focused tests passed, including real DSH registry activation, native configuration gating, actual thirty-commit refresh, cooldown, project/global decline, and first-run persistence. Git pathname enumeration uses NUL-delimited output without trimming pathname whitespace. Remaining coverage code still depends on legacy Git helpers, so those original files remain unresolved and must not be claimed removed from distribution yet.

## Lifecycle coverage replacement and legacy distribution removal

The independently authored coverage collector uses NUL-separated Git tracked paths, observed source extensions and directory exclusions, immediate-directory file/line thresholds, and ancestor AGENTS.md coverage bounded by the repository root. The public matrix of 37 extensions and 11 directory names matched the prior implementation exactly. The active onboarding caller now uses independent coverage, Git helpers, and drift detection. Ten focused tests passed, including actual DSH lifecycle activation and refresh proposals. Runtime-source reference search found no remaining vendor/lifecycle import. The entire legacy lifecycle directory is explicitly excluded from npm distribution, while historical research evidence is retained. Full overall migration and final distribution audit remain incomplete.

## Lifecycle final regression and session-finder MIT candidate

The lifecycle replacements and legacy distribution exclusion passed the full standard regression: 659/659 tests, zero failures, skipped, or cancelled, log /tmp/scrum-independent-lifecycle-final-tests.log.

A separately published MIT TypeScript session finder is pinned at https://github.com/code-yeongyu/coding-agent-sessions-ts commit dcb9cef579a53d7bec81baadd69b8445acf9d972. Its copyright and license were checked before reading implementation. Preferred source and license are shipped in vendor/session-finder-independent; session-finder-build.mjs generates the Node 24 ESM runtime and records source/output hashes. The candidate passed a local Pi JSONL list, assistant-body search, and matched-event read acceptance case. It is not yet the active coding-agent-sessions skill: OMP/Gajae default roots, child linkage, broader platform behavior, and packaging reproducibility need comparison before the original skill can be retired.

## Session finder OMP/Gajae migration gap resolved

Actual public CLI comparison with isolated synthetic homes showed the legacy finder discovered six Pi/OMP/Gajae sessions while the separate MIT candidate initially discovered only the two Pi sessions. Its MIT platform registrations and JSONL root definitions were adapted to add oh-my-pi at .omp/agent and gajae-code at .gjc/agent. Rebuilt candidate now matches the legacy result for all six sessions across platform, id, cwd, provider, model, first/last user message, parent_id, and subagent_count. Two focused tests pass, including OMP and Gajae default-home discovery without scanning other platform stores. Build provenance explicitly records these source modifications.

Evidence: work/independent-session-finder/acceptance-summary.json and pi-all-platforms-comparison.json. These particular child headers are not linked by either version; this does not prove all child linkage formats. The active legacy skill remains until broader platform, linkage, flags/redaction, and documentation/launcher acceptance are complete. An exploratory legacy help invocation unexpectedly started scanning; its exact test process was terminated, and subsequent tests use isolated homes and explicit platform selection. No real user transcript is retained in the synthetic proof.

## Session finder active skill replacement

The adapted MIT source passed all 14 upstream tests in an isolated home, including child filtering/counts, parent reads, search filters, event body search, bearer redaction, GUI/remote Codex roots, Kodu SQLite, and real CLI JSON output. The worktree legacy skill has been moved to private research storage and replaced with an independently authored workflow, platform notes, Node launcher, and Python compatibility launcher. No legacy Python parser implementation remains in the active skill. Installed read hints use the exact launcher path and shell-quote session identifiers; a space-containing clean fixture installation verifies the emitted hint actually reads the session without executing a synthetic injected command. Three focused finder/launcher tests pass. The resident installation is unchanged and broader differential acceptance remains open.

## Session finder full regression and agent definition replacement

The active session-finder skill replacement passed the full regression at 662/662, zero failed/skipped/cancelled (log /tmp/scrum-independent-session-finder-final-tests.log). Distribution audit confirms preferred MIT source, license, runtime and Python compatibility launcher are present; no old Python parser modules or private research directories are included.

The agent definition loader is independently authored in independent/agent-definitions.mjs; the root entry now re-exports it and the prior implementation is privately backed up. Public black-box comparison established source priority (project Claude, user Claude, project OpenCode, global OpenCode), public scope labels, fixed GPT 6.1 Sol low, requested model retention, and tool normalization. Existing parity tests pass. Additional tests cover project symlink escape refusal, source priority, fixed model and readonly tools. Full behavior and final package audit for this new replacement remain pending; no resident change has been made.

## Agent definitions full regression and independent MCP configuration

The agent-definition replacement full regression passed 663/663 with zero failed/skipped/cancelled. The next active replacement is independent/mcp-configuration.mjs, now re-exported by mcp-config.mjs. Public black-box observations established explicit Claude inheritance opt-in, safe environment names, unapproved token removal, fallback and empty-value behavior. The independent adapter merges scoped configs in order, filters sibling-project local servers, removes disabled inherited servers, retains dedicated trusted overrides, and reuses the existing lazy builtin definitions. Fourteen focused MCP tests pass, including registered command/schema/resource behavior, native local servers, scope inheritance, builtin overrides, and explicit unapproved-token tests. Evidence: /tmp/scrum-independent-mcp-config-final-tests.log and work/independent-mcp-config/environment-comparison.json. Whole-plugin completion, provenance clearance and resident activation remain unproven.

## Independent command template reader

Command discovery is independently implemented in independent/command-templates.mjs and the root commands.mjs now re-exports it. The original is privately retained as evidence. Public observations established source order, Scrum body-only templates versus compatibility instruction/user-request wrappers, nested slash names, front matter metadata, and scope labels. The independent scanner deduplicates first-source names, honors disabled commands, confines symlink targets to each command root, and terminates directory cycles. Twenty-two focused tests pass across nested discovery, front matter, configuration reload, existing parity, and argument/reference expansion. This does not claim whole-goal completion or resident deployment.

The independent MCP expansion now matches all 21 stored public environment observations, including unapproved variables, fallbacks, empty approved values, and unsupported-name removal. The evidence file has been updated with the final implementation outputs.

MCP configuration replacement full regression completed at 665/665 successful tests with no failed, cancelled or skipped cases (/tmp/scrum-independent-mcp-config-full-tests.log). Command-reader replacement has its 22 focused tests; its final whole-plugin regression is the next run.

### Independent planning instructions

Replaced hyperplan prose with independently authored seven-phase planning instructions using existing local acceptance requirements, without reading the retired prose. The original is retained only under work/independent-skills/previous/hyperplan. Full behavioral acceptance remains pending. Command-template replacement full standard suite: 666 passed, 0 failed (92444.986125 ms), /tmp/scrum-independent-command-templates-full-tests.log.

### Independent execution and coordination instructions

Replaced ulw-execute, boulder, and atlas prose without reading retired bodies. Instructions derive from the authorized delivery requirements and current WorkflowStore public operations: canonical task references, transitive stage dependencies, bounded owned plan paths, checkpoint, pause/resume, connected-set handoff, verification and delivery reconciliation. Retired bodies remain under work/independent-skills/previous only. Full behavioral acceptance remains pending.

### Independent goal-loop workflow

Replaced ulw-loop SKILL and its two references from the local goal-toolkit operation contracts and current independent acceptance tests. No retired text was read. Describes acquire-vs-complete distinction, essential evidence, blocker gates, session ownership, stop/resume, and immutable host bindings. Full behavior acceptance remains pending.

### Independent repository-instruction workflow

Replaced init-deep prose without reading the retired body. The replacement specifies verified repository exploration, hierarchical AGENTS guidance, preserving user constraints, path/command verification, and snapshot only after actual documentation work. Lifecycle integration acceptance remains covered by actual DSH activation tests; full instruction behavior acceptance remains pending.

### Cancellation test ordering correction

Full suite after execution-skill replacement: 665 passed, one failed in desktop-independent-code-test outstanding-native-work cancellation. Its 30 ms timer could abort during worker startup before a native call existed; the assertion incorrectly required a native abort in that case. Moved the timer into the backend after abort-listener registration, and added a separate immediate-cancellation case proving no native operation starts. Production cancellation semantics were not weakened or changed.

Operational-skill replacement final standard suite: 667 passed, 0 failed. Focused workflow/command checks 10; goal-loop/skill input 8; lifecycle 7; desktop cancellation 7, all passed. Distribution dry-run includes all eight changed skill/reference files and no work snapshots (732 package files). Full model-driven behavior and entire public-license audit remain open.

### Comment-checker binary release verification

Downloaded @code-yeongyu/comment-checker 0.8.0 from its published registry, verified the SHA-512 integrity, and matched all five vendored native binaries by SHA-256. The npm tarball omits LICENSE; independently retrieved the MIT LICENSE from v0.8.0 peeled source commit ec3c30c1f4c51a245ab82ffca74241868f902f3f. Existing notice matches pinned release byte-for-byte. This verifies the separate binary distribution only; the protected OMO comment-checker core remains to be replaced. Evidence: work/independent-comment-checker/binary-registry-verification.json.

### Independent comment inspection core

Replaced the OMO core runner, stdin helper and apply-patch extraction adapter with independent/comment-inspection.mjs and an independently authored root adapter. Derived from native subprocess APIs, existing acceptance tests and observed public output contracts; no protected core bodies read. Bounded input/output, literal argv, Unicode stream decoding, process cleanup and cancellation are handled locally. Twelve metadata/patch observations match. Seven inactive protected core/source/license/provenance files moved under work/independent-comment-checker/previous-core, retaining the five separately MIT native binaries and license. Added previously omitted core files to provenance inventory instead of treating the initial inventory as exhaustive.

Expanded patch comparison to 93 captured public cases. Corrected unchanged-hunk extraction (no inspection should be emitted) and empty metadata path compatibility. Focused five tests passed including all 93 cases. Initial full standard suite passed 670/670; rerunning after the additional compatibility corrections.

Final comment-core replacement standard suite: 670 passed, 0 failed, 92531.512791 ms (/tmp/scrum-independent-comment-inspection-expanded-full-tests.log). Distribution gate: 726 runtime package files; independent source, root adapter, all five binaries and MIT notice present; no retired core or work snapshots. No resident deployment performed; full objective and remaining provenance/behavior gates remain active.

### Independent onboarding and cleanup instructions

Replaced onboarding and remove-ai-slops prose without reading retired bodies. Grounded onboarding in current lifecycle command registration and state semantics, independent plugin ownership, HardTackle authorization, evidence and activation boundaries. Cleanup instructions preserve recovery/permission/validation logic and require caller-backed findings. Existing onboarding helper scripts remain unresolved and are not claimed replaced. Debugging and data-scientist multi-file workflows remain unresolved.

### Independent data query runtime

Replaced the old quick-query.py with a stdlib launcher and independent/data-query.py. Supports five file formats, schema/statistics, DuckDB SQL against an explicitly registered data relation, and Polars SQL filters. Fifteen actual-engine synthetic cases match the original stdout and exit codes. Help/missing-file tests use only the standard library. Legacy dependency-error traceback exposed a short implementation snippet during public CLI probing; no old source file was opened or copied. The original script is private work evidence. Remaining data-scientist documentation and installers remain unresolved. Onboarding/cleanup full standard suite completed with 670 passed, 0 failed; data query full suite is in progress.

Data query extended acceptance found and fixed CSV date-inference loss: SQL now uses native DuckDB file readers rather than a Polars-typed intermediate. Original stdout still matches all 15 basic cases and added date arithmetic. Added an unconditional real-engine regression to the standard Node test command covering five formats, filters, aggregates, descriptive statistics, quoted filenames and dates. Three focused tests pass; engine prerequisites are documented and never silently installed or skipped. Preserved original launcher file mode.

Final data-query standard suite: 673 passed, 0 failed, 100387.1155 ms. Real engine regressions are included in that suite. Relocated two-file CLI layout with spaces also passed. Distribution initially omitted usage documentation; added that specific document to package.files and verified both runtime files and documentation are present, with no private work evidence. Data-scientist skill documents and environment helpers remain unresolved; overall completion stays false.

### Independent data-analysis workflow documentation

Replaced data-scientist SKILL and five references without opening retired prose. New instructions cover provenance, schema/quality checks, inferential limits, reproducibility, runtime selection, artifact placement, actual query interfaces, explicit environment dependencies and faithful visualization. Four environment helper scripts remain unresolved and are explicitly distinguished from the independently implemented query runtime. Full model-driven behavioral acceptance remains pending.

### Skill metadata and delivery-interface audit

Compared retired and replacement frontmatter as public metadata, excluding original description prose. No data-scientist permission metadata was lost. Found omitted argument hints in hyperplan, remove-ai-slops and ulw-execute, plus two short-description fields. Restored public argument syntax and independently worded short descriptions. Added independent ulw-execute instructions for requested plan/worktree binding, direct vs make-pr vs ship delivery, verified head, repository gates, ownership, state sync and cleanup, matched to current DeliveryGates operations. No external publication action performed.

Data documentation and skill metadata final full standard suite: 673 passed, 0 failed. All six data documentation files are present in the runtime package, with private originals excluded. Four environment helper entry points were probed in isolated HOME/PATH using mocked external commands to derive their public invocation behavior; this is not claimed as actual installation acceptance. Helper implementation and broader behavior gates remain open.


### Independent data environment helpers

Four legacy environment entry points now call the independently authored Node 24 engine. Isolated real Python dependency imports, native DuckDB Node query (42), and official UV fresh installation passed. Five focused regressions passed. Original helpers are retained only under private work snapshots. Windows real installation and whole-plugin release acceptance remain open. No resident deployment was performed.

Final environment-helper regression: 680 passed, zero failed. Seven focused tests include executable lookup boundaries and shell-free Windows npm CLI dispatch. Windows real installation remains unverified.


### Independent DAP framing

Replaced the DAP helper module from the public Microsoft wire specification and isolated public API observations. Retains four exports, byte framing, UTF-8 fragmentation, concatenated frames, and malformed JSON recovery. Four focused regressions passed. Adds explicit header/frame bounds and safe non-string endpoint rejection. Endpoint classification is not connection authorization or port validity. Remaining debugger fixture, documentation, live adapter acceptance and full release gates remain open. Original helper is private under work/independent-debugging/previous.

Debugging replacement expanded to 22 independently authored documents and an independent synthetic adapter. The captured synthetic wire comparison matched 13 messages. Actual debugpy 1.8.22/Python 3.12.12 acceptance established initialization, a verified breakpoint, stopped-state variable value 42, evaluation, continuation, termination, disconnect and owned adapter exit. Six focused tests passed. Public helper metadata retains name debugging. Preferred-source bodies were not read or copied for these replacements. Native test is part of the standard command and requires prepared debugpy; missing dependencies fail rather than skip. Broader runtime/platform and model-driven skill acceptance remain open.

Final debugging regressions: 686 passed, zero failed, including real debugpy acceptance. Distribution dry-run confirms both independent modules, compatibility entry points and all 22 guide files; private evidence and native acceptance harness are excluded. Git-master, give-me-tips and frontend independently authored guides subsequently passed three existing provider/contract tests; broad model-driven guide acceptance remains open.

Independent workflow guide replacement: dag-library, mass-ulw plus planning reference, ultrawork compatibility, ulw-research and visual-qa authored from existing independent runtime contracts and user constraints. Public name/argument metadata preserved. Provider and skill-input tests passed (6). Model-driven acceptance and full release remain open.


### Independent GitHub LSP installation

Added pinned release identity, source-asset selection, bounded download, published digest checking when supplied, owned extraction, recorded archive and executable hashes, and receipt tamper refusal. Separately licensed tar 7.5.22 (BlueOak-1.0.0) and yauzl 3.4.0 (MIT) power extraction; exact notices and source commits recorded. Fourteen focused checks passed. Actual Texlab 5.26.0 installation, receipt reuse, real LSP initialization, document-symbol retrieval and owned shutdown passed. Remaining GitHub platform/format, gem/opam/generic and full release acceptance remain open. Dependency installation reports 13 vulnerabilities (7 moderate, 6 high); final dependency audit is not complete.

## OAuth issuer binding and dependency security update

Upgraded MCP client to 2.3.1, js-yaml to 4.3.2 and fflate override to 0.8.3. npm audit reports zero known vulnerabilities for this lockfile. OAuth persisted credentials retain their issuer, per-issuer legacy entries retain their reliable binding, unknown global credentials are not reused, and configured secrets require an explicit issuer. The approved registration workflow stores the discovery issuer. GitHub dedicated registrations use the issuer verified from GitHub public metadata. Related 29 tests pass; full suite and final real-connection gates remain. Resident credentials and application have not been changed.

## Independent LSP setup helpers and guides

Replaced the setup skill, twenty language guides and four helper/config files from the independent host client and separately licensed registry metadata. New detection bounds traversal and excludes symlinks/dependencies; verification uses actual native Texlab and closes its CLI-owned clients. Two focused tests pass. Existing helper invocations failed under Node 24 before replacement; automatic error traces displayed a short protected source excerpt, which was not used to author replacements. Old CLI compatibility, installer routes, platform support and real model skill selection remain acceptance gates.

## Independent planning scaffold and guidance

Replaced the planning skill, three workflow references, display metadata and scaffold/template helpers using the current independent plan parser and execution contracts. New plans preserve full completion conditions, uncapped practical task decomposition and final verification. Exclusive writes preserve existing documents and reject unsafe names or symlinked directories. Three parser/provider integration tests pass. Old public export/CLI compatibility and real model planning remain acceptance gates.

## Direct MIT public-reader candidate

Pinned fivetaku/insane-search d29166fbd2a8e54cb77e0e47a52f456709417973 from its original repository, verified MIT notice and retained unchanged preferred sources in a private candidate. All twenty upstream test files execute successfully with an explicit test import path. An actual HTTPS public-page request returns content and an untrusted-content wrapper. The old public API metadata was inspected without reading its implementation bodies; OMO-added surrogate/provenance/trust compatibility remains to be independently implemented. Candidate is not active and is not shipped yet.

## Activated independent public-reader host

Retired the OMO-modified engine to private evidence. Its public module interfaces are now independent adapters over directly obtained MIT insane-search preferred source. Surrogate/target validation/provenance logic is independently authored. Actual Reader response identified a cached snapshot, so the adapter records snapshot/archive with unknown capture time instead of live or a fabricated timestamp. The actual Wayback availability response identified a different target; new target binding rejects that route. Nine adapter tests and twenty original-source test files pass. Host CLI retrieves an actual public page and the infrastructure/personal-path gate passes. Source notices and digest manifest are included. Broader browser backends, remaining skill text and cookie extraction, clean package, actual model and whole-plugin acceptance remain pending.

## Independent public reader package and browser guidance

The public reader replacement passed the 703-test standard regression run. Actual isolated package extraction verifies pinned MIT source hashes and a public-page CLI response. Python bytecode caches are explicitly excluded from npm distribution; the preferred-source archive preserves upstream repository metadata omitted by npm. Twenty-two browser/research guidance files were independently authored without reading protected guide bodies. Native DSH skill discovery and retrieval loaded the new guide, and six focused provider/input/reader tests passed. Private original guides remain under work and are excluded from distribution. Cookie helpers, programming support, remaining provenance closure, and whole model/combined-host acceptance are still pending; this is not a whole-plugin release approval.

## Independent cookie domain boundary

Replaced cookie_domains.py from public signatures and synthetic-domain black-box outputs, without reading its protected implementation body. The independent parameterized SQLite selector preserves exact domains, leading-dot domains and subdomains while escaping wildcard literals and rejecting malformed SQL column identifiers. The regression uses an in-memory database with unrelated and attacker-suffixed domains; no account cookies are read. The standalone test passes. Other cookie helper interfaces remain pending. A fixed-commit browser_cookie3 candidate is private research only, not adopted or shipped; its LGPL obligations and adapter fidelity require further verification.

The updated standard regression passed 704 tests with zero failures. A synthetic Firefox database demonstrates that the private browser_cookie3 candidate returns unrelated suffix/prefix hosts for domain_name; adopting it requires independent post-extraction domain filtering, not simply forwarding its filter. No actual user credentials were accessed. Candidate remains unshipped.

## Independent cookie profile discovery

Replaced cookie_paths.py from public TypedDict fields, conventional location configuration and isolated filesystem black-box behavior, without reading protected function bodies. Chrome, Brave, Chromium and Firefox layouts passed on synthetic darwin/linux/win32 trees, including preferred profile/database order and missing profile failure. The focused two-test run passes; these are layout compatibility checks, not claims of live cross-platform credential extraction. Crypto/extraction remain pending.

## Independent cookie crypto

Replaced cookie_crypto.py using hashlib PBKDF2, cryptography AES-CBC/PKCS7 and AES-GCM, explicit OS keyring access and own Windows DPAPI binding. Synthetic known key derivation and encrypted payloads reproduce public platform outputs. Unknown/truncated envelopes and a modified GCM authentication tag are rejected. Keychain success/denial and Windows Local State parsing use synthetic mocks; no real account secrets were read. Three focused crypto/path/domain tests pass. Windows native binding remains unverified on real Windows and whole extraction/CDP acceptance is pending.

## Independent cookie extraction, export and CDP

Replaced extract_cookies.py and retired its protected tests to excluded private evidence. Own SQLite backup captures committed WAL records without altering the source; parameterized domain filtering, AES decryption, epoch conversion, private atomic JSON export and callable keyring interfaces retain public behavior. Four focused tests pass. An isolated Chromium accepted and returned a synthetic session cookie through the actual loopback CDP path; that owned browser was closed. No account cookies were accessed. Chromium version 24 domain-hash binding is independently implemented and tested against tampered domains, using the primary protocol change description at https://chromium.googlesource.com/chromium/src/+/5ea6d65c622a3d5ff75db9dc0257ea3869f31289%5E%21/ . Whole release/provenance/combined model acceptance remains pending.

Actual macOS Keychain validation created a unique synthetic fixture, read it through the independent helper, and deleted that exact fixture successfully. Account secrets were not read. The package includes the independent cookie helpers and no private legacy tests or generated Python bytecode. Full regression is rerun after final domain-integrity and snapshot timeout changes.

Final cookie extraction changes passed all 707 standard tests. Actual isolated package extraction/import/export verifies the shipped own helpers and their source hashes. Private original helper tests and generated bytecode are excluded. Remaining programming interfaces were inventoried by public function/parameter metadata without exposing protected implementation bodies; this does not constitute their replacement.

## Independent Python script scaffold

Replaced the Python script generator from public function/CLI metadata using argparse and stdlib exclusive file creation. The generated script includes inline dependency metadata, executes successfully, parses as TOML, and refuses existing output and path-like names. No third-party dependency installation is performed by the generator. Other programming scaffolds and whole-plugin acceptance remain pending.

## Independent Python application/library generator

Replaced the generator from public signature/flags and harmless black-box uv command observations. Own implementation creates a standalone uv app or library, refuses existing destinations, configures basedpyright strict mode and Ruff, and installs the same documented development tools. Initial generated test formatting failed Ruff; the generator was corrected and both project modes were regenerated. Actual pytest, Ruff and basedpyright checks all pass in both final fixtures. Two focused helper tests pass. Original bodies/templates were not used; original helper is retained only in excluded work evidence. Other programming helpers/guidance and whole-plugin release acceptance remain pending.

## Independent Rust generator

Replaced Rust scaffolding from public signature, native Cargo command behavior and manifest/dependency metadata. Own generated source passes native formatting, build, Clippy and execution. Destination guard regression preserves an existing project and rejects traversal. No trivial mirrored unit test is generated; actual compiled binary output is checked. Rustup automatically installed stable 1.99.0 during validation. The cargo-deny configuration follows official schema documentation, but the command is absent and actual deny acceptance remains pending. Go command/file-layout interfaces were captured without reading protected template bodies; they are not yet replaced. Whole release acceptance remains pending.

## Independent Go scaffold and templates

Replaced the helper and all ten templates using own source authored from public signatures, file layout and import paths only. Native Go resolves env/v11 11.4.1, formats, compiles, vets and builds the generated module. Native go test -race succeeds with no generated unit tests; that is not reported as test-case coverage. Actual owned loopback service returns the health response and exits zero on SIGTERM. The current rendered source exactly matches the natively verified formatted fixture. Destination guard test preserves existing projects and generated files. The linter configuration still needs actual golangci-lint validation, and whole plugin acceptance remains pending.

## Independent TypeScript/Bun scaffold

Replaced the generator from public parseArgs schema and harmless generated manifest metadata. Own Node-compatible generator retains Bun/Hono/Zod mode and check commands. A private Bun 1.4.3 fixture binary matches the official GitHub release SHA256; it is excluded from distribution. Initial JSON array formatting failed Biome and was fixed in the generator before regeneration. Actual generated project passes Biome, tsc and three HTTP tests; its loopback server starts and returns health before its owned process is stopped. Both Bun and Node run the generator, and destination guards preserve existing projects. Whole release and remaining policy/guidance acceptance are pending.

The current combined language-scaffold changes pass all 712 standard regression tests. No skips or failures were reported. Sixty-four original inventory rows still require provenance replacement/review, in addition to later component/whole-host acceptance gates; regression success is not whole-goal completion. Python policy black-box fixtures have been recorded for the next independent replacement without reading its protected body.
