# Current independent replacement release

See [Scrum 0.7.0 release audit](independent-release-audit.md) and [evidence](independent-release-evidence.json) for current implementation, verification and licensing scope. The following text is the chronological migration diary; intermediate counts and incomplete stages are historical, not current release status.

# Scrum independent implementation migration

The user chose to replace OMO-derived material rather than seek relicensing permission (2026-10-10).

## Completed changes

role-prompts.mjs no longer imports or executes vendor/omo/agents.mjs. Its role instructions and execution requirements have been written for Scrum. Persisted role identifiers and legacy planning paths remain compatibility interfaces. The connected roles.mjs policy continues to enforce read-only and planning boundaries. These changes do not make the entire package independently licensed.

## Inventory

independent-implementation-inventory.json records 424 files requiring review and 97 dependency references, including tests. This is a file-level starting inventory, not 424 distinct features. Independent projects embedded in these directories must retain their actual original licenses; an OMO directory name alone is not a license finding.

## Acceptance criteria

For every runtime module, skill, prompt and binary: record the source of the functional specification, replacement implementation and tests. Do not use textual paraphrase or a directory rename as proof of independence. Reimplement behavior from public interfaces and product requirements, preserving session compatibility and feature acceptance tests. Review wrappers outside vendor for copied material too. A fresh author or legal review may still be needed to assess derivation because the current implementation and its source have already been seen.

Do not switch the package to AGPL, publish or deploy a partially replaced build as license-clean. Retain original notices until the associated material has actually been removed from the public distribution.

## Remaining execution order

1. Role registry: existing BUILTIN_AGENTS identifiers were compared with roles.mjs and the replacement registry; all seven remain available. Broader saved-session and tool-policy acceptance remains to be checked.
2. Shared tools and configuration: parsers, search formatting, editing/LSP contracts, hooks, model/config migration.
3. Team/workpool/DAG, delivery and continuation state machines: preserve crash recovery and idempotency.
4. Memory scheduling, recall, reflection and reconciliation: preserve secrets filtering and state integrity.
5. Browser and desktop backends: distinguish separately MIT-licensed dependencies from OMO-specific adapters/binaries, replace the latter and run real integration checks.
6. Rewrite copied skill and persona text against the new APIs; remove unused derived assets and porting scripts from release trees.
7. Audit all package inputs, regenerate notices, run full regression and single/combined plugin integration checks; only then apply the agreed public license and publish.

Resident installation has not been changed by this migration step.

## Goal work checkpoint

An active goal now covers the full replacement and release-tree audit. No subagents are used. Initial whole-suite baseline after role, media, search and request classification changes: 498/498 passed (log /tmp/scrum-independent-goal-tests.log). Later changes have targeted passing checks and need a final whole-suite run.

Additional replacements: independent/search-format.mjs, image-size.mjs, request-classification.mjs, media-input.mjs, dream-gates.mjs, idle-notices.mjs, todo-policy.mjs and memory-personas.mjs; noninteractive.mjs no longer imports copied constants. YAML users now import the existing MIT js-yaml dependency directly. The independent directory is explicitly included in npm files. Old vendor material remains until all consumers and public release inputs have been audited; these entries are not marked fully cleared.

Next: shared tool/config contracts, memory algorithms and schedules, workpool/DAG and desktop. Remaining vendor code, derived wrappers, skills and binaries must still be replaced or positively verified as separately licensed. Final tests, integration, removal of superseded distribution assets and package provenance audit remain required. Goal is active, not complete.

## Stage 2 checkpoint

Added independent plan parser, MCP arguments and connection identity helpers, tool recovery, secret filtering, reservation transitions, backoff, recall query generation and memory frontmatter/rendering. Root references to OMO/desktop imports now total 58 (including tests), down from the previous 82. This metric does not include copied assets, transitive code or derived wrappers and is not a completion percentage.

Targeted evidence: 29 plan/MCP/workflow checks, 11 tool-hook checks, 22 reservation/integration checks, 7 recall/profile checks; SDK and actual protocol fixtures included. Whole-suite intermediate run: 501 passed. A new immutable-code full run is in /tmp/scrum-independent-stage2-final.log; inspect its final result rather than inferring it from earlier output.

Next: memory schema, selection/indexing, cursor/budget/integration, configuration and tool contracts; then workpool/DAG and desktop/browser/skills and the final release-tree audit. No resident deployment or license switch has occurred. The stage2 review explicitly leaves journal-aware reservation parity and surrounding wrapper provenance unproven.

## Additional verified checkpoint

The complete stage-two regression run passed 501 tests with zero failures (log: `/tmp/scrum-independent-stage2-final.log`). A subsequent independent identity-policy notice implementation replaced the two runtime imports of `memory-soul-paths`; its policy matching, Git memory and profile integration passed six tests. This subsequent change still requires the next whole-suite run. No resident installation or license relabeling was performed. The full migration remains incomplete.

## Memory policy and initialization checkpoint

The notice checkpoint whole suite passed 502/502 (`/tmp/scrum-independent-soul-final.log`). Subsequent changes replace the configuration validator, filesystem identity boundary and initial memory documents. Configuration compatibility was checked through the former public API, including integer ranges, nested overrides, zero values, unknown fields and explicit undefined values. No implementation source was copied for these replacements. New initialization documents record no invented user facts and use `scrum:independent-memory-seeds-v1` provenance. Existing committed user documents are not rewritten.

The native DSH filesystem test verifies sibling memory denial, canonical targets, a symlink switched to a foreign identity, missing targets below that symlink and preservation of foreign content. This is a filesystem boundary test, not proof of the still-unmigrated process sandbox or soft tool guard.

Memory reminder replacement: conflict and dirty-state transitions retain their deduplication contract. Text is written for Scrum and states that remote publication uses human-only sync, rather than promising an automatic upstream sync service not enabled by this host. An incorrect import name was caught during testing and fixed; seven focused tests pass. The overlapping whole-suite run saw the pre-fix import and is not accepted as release evidence. A subsequent frozen-code run is required.

The overlapping test also exposed a stale assertion in the native memory integration test: it matched the former seed wording rather than checking the identity section and policy behavior. The test now verifies the self section, acceptance-criteria guidance and the prohibition on memory granting permissions. This does not relax the tool permission, recall, checkpoint or Git assertions in that test.

Final checkpoint for this batch: the post-fix whole suite completed with zero failures; details are in `/tmp/scrum-independent-memory-frozen-final.log`. The source modules remained unchanged during this run; one stale test assertion was corrected before that test executed, and its focused run also passed. This checkpoint covers the memory settings, filesystem boundary, initial documents and maintenance reminders. Full OMO removal and public distribution audit remain incomplete.

## Transcript and process monitor checkpoint

Independent replacements now serve the native thread reader and ProcessMonitor. Native thread operations, fork lineage and transcript paging pass six focused checks including file JSONL recovery, oversized items and cross-session cursor isolation. Live thread snapshots include their session identity in the revision. A single over-budget transcript item returns an explicit recoverable error instead of exceeding the requested budget; this fixes the former public API's observed limit violation without dropping content.

The process stream implementation preserves split UTF-8, CRLF, bounded line prefixes, binary suppression and batch sequence/timer disposal. Eight existing integration checks passed with real processes, PTY, browser state and owner-scoped deletion. Six focused monitoring checks also passed. Ordinary regex lookaround and alternatives remain supported; the nested-repetition guard is static and is not represented as a complete regex complexity guarantee.

The migration remains incomplete. Old vendor files and notices remain retained pending final dependency closure and distribution audit. No resident deployment or public license relabeling occurred.

The transcript/process-monitor whole-suite checkpoint passed 513 tests with zero failures (`/tmp/scrum-independent-transcript-monitor-final.log`). Source and test files were held unchanged during that run. It covers all current regression tests, not a claim that the remaining unported dependencies have been replaced.

## Memory budget and lexical retrieval checkpoint

Independent modules now replace token estimation, pressure-Dream budget validation, expansion-input validation, search strategy selection and candidate ranking. The estimate counts UTF-8 bytes in regular system Markdown documents and rounds each document upward at four bytes per estimated token; it is not a model tokenizer. Pressure-Dream success requires strictly below its target, and invalid measurements are rejected. Nine Git/job integration checks passed.

Candidate retrieval is implemented from standard BM25 and reciprocal-rank fusion, with Latin phrase/term matching and CJK bigrams. The former implementation source was not reused. Algorithm reference: [Apache Lucene BM25Similarity](https://lucene.apache.org/core/9_9_1/core/org/apache/lucene/search/similarities/BM25Similarity.html), documenting k1=1.2, b=0.75 and IDF. Numeric candidate scores are independent, not claimed bit-identical. Required lexical retrieval, expansion fallback, surfaced filtering, session receipts, Korean inflection, Japanese queries, hybrid ranking and actual Git remote integration pass focused tests. Long-line excerpts are centered on matched terms so a relevant result does not return only an unrelated prefix.

Seven existing native recall/sync tests and three new budget/routing tests pass. Eight selector/query-planner tests pass, including long passages and a 221-document corpus. Full-suite verification is pending for this batch. Existing user memory was not modified; deployment and publication remain pending the full goal.

Whole-suite checkpoint: the budget/retrieval replacements passed 519 tests with zero failures (`/tmp/scrum-independent-recall-budget-final.log`). The source and tests were unchanged for this complete run. The inventory records 28 rewritten files and 44 remaining reference entries; these are source-reference counts, not feature coverage percentages. Full migration remains incomplete.

## People, committed prompt compilation and tool guard checkpoint

Independent people-card parsing/serialization preserves prefixed entries, dated Explicit/Deductive/Inductive/Contradiction observations and provenance fields. Invalid structured observations and newline injection are rejected rather than silently losing data. Fresh human seeds now use the supported section names; previously committed user documents are not rewritten.

The independent prompt compiler consults only the supplied Git revision, embeds self/person records, escapes forged markup delimiters, redacts secret-like material, and builds a bounded reference index ordered by commit time within each directory. Omitted index entries are reported and remain accessible by search/read. Existing profile/native/maintenance tests pass, and five new compiler/card tests cover round trips, invalid values, seed validity, source revision, markup and projection limits.

The file-tool guard no longer imports the former memory-guard module. It canonicalizes real and missing paths, including dangling symlinks, checks rename/patch destinations and rejects recursive enumeration across the memory family. Shell handling remains an advisory warning, not process confinement. A duplicate-warning defect caught by the existing test was fixed by keying the bounded warning set by session ID and workspace. Four focused guard tests pass, including missing targets under a foreign symlink.

The batch is awaiting complete regression verification; source provenance and remaining vendor dependency closure still prevent a public-release completion claim.

Whole-suite checkpoint: people-card, committed compiler and soft-guard replacements passed 525 tests with zero failures (`/tmp/scrum-independent-people-compiler-guard-final.log`). Source and tests were held unchanged throughout the run. This proves the current regression checkpoint, not completion of the still-active full migration goal.

## Cursor and Git integration checkpoint

The independent cursor preserves the durable schema and complete-message grouping. Only contiguous acknowledged history advances the host queue; failed verification does not advance, and partial-group or backward finalization is rejected. Existing queue splitting, merged jobs, restart, checkpoint and integration tests passed (21 checks).

The independent integration uses Git three-way merging under the existing writer lock. A committed `Scrum-Run` trailer is its replay receipt. Legacy `Omo-Run` trailers are read for compatibility, but are accepted only on real merge commits containing the validated proposal and base. Existing user operations (merge, rebase, cherry-pick, revert) are not aborted or changed. A failed merge started by the current invocation is aborted; dirty parent edits are preserved. A completed run ID associated with a different proposal returns an explicit failure rather than producing another merge.

Additional tests cover legacy receipts, clean-index caller merge state, group finalization and conflicting run reuse. Actual SIGKILL-after-integration recovery remains covered by the existing suite and passed after replacement. The old module implementation source was not reused. This checkpoint still needs whole-suite verification; it does not clear the remaining runtime/skill/desktop dependencies or publication audit.

Whole-suite checkpoint: independent cursor and Git integration passed 529 tests with zero failures (`/tmp/scrum-independent-cursor-integration-final.log`). Source and test files were held unchanged during the run. The full migration and public-distribution verification remain incomplete.

### Side context, retention policy and installed Claude plugin loader

Replaced three runtime imports with Scrum implementations. Side context projects text only and bounds Unicode JSON bytes. Retention keeps DSH spill recovery and established token budgets. Hook discovery enforces enabled settings and installation scope; hook manifests combine standard files, additional files and inline configuration, deduplicating canonical files and rejecting paths/symlinks outside the plugin root. Official manifest contract: https://code.claude.com/docs/en/plugins-reference . Existing hook, side-session and retention scenarios: 29 passed; added discovery/containment scenarios: 3 passed. Whole-suite verification pending. Runtime replacements do not clear remaining vendor asset provenance.

Hook loader checkpoint: whole standard suite 532/532 passed, zero failures; source/tests held unchanged. Log: /tmp/scrum-independent-hook-loader-final.log.

### Independent X search and skill

Replaced xAI adapter dependency with the public Responses API, freshly authored prompt/skill and synthetic response fixture. Credentials are resolved on each call. Calendar validation, exclusive allow/exclusion filters, source citation deduplication, usage/query extraction, cancellation and bounded response reading remain supported. Uncited provider prose is not presented as source evidence. Provider HTTP error bodies are not exposed. Model selection is configurable via SCRUM_X_SEARCH_MODEL; the established default is retained. Official contract: https://docs.x.ai/developers/tools/x-search . Four focused scenarios passed. No live paid xAI call was made in this checkpoint; public provider connectivity remains separate from the regression claim. Vendor source/fixture assets remain until final package pruning.

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
