# Independent desktop replacement — in progress

The worktree now uses the independently authored desktop controller and native helpers. Protected desktop assets are inactive private evidence and excluded from the draft npm package. The resident application has not been updated. Full release and licensing verification remain incomplete.

Earlier sections below are chronological evidence, not the current remaining-work list. The latest controller and background-input section supersedes older statements that those components are not implemented.

## Verified components

- `independent/desktop-peekaboo.mjs` is independently authored. It invokes a caller-supplied Peekaboo executable with separate argument vectors, bounded stdout, subprocess cancellation and timeout, and does not retain stderr that may contain confidential input.
- Peekaboo 4.9.0 is separately licensed MIT software (copyright Peter Steinberger). Package evaluated from npm `@steipete/peekaboo@4.9.0`, isolated under `/tmp/scrum-peekaboo-evaluation`; it was evaluated before becoming an optional dependency; final release auditing remains open. Primary sources: https://github.com/openclaw/Peekaboo and its LICENSE.
- Actual permission inspection succeeded for Screen Recording, Accessibility and Event Synthesizing. Actual desktop capture succeeded, yielding a bounded PNG (1200 × 675, 307516 bytes). Evidence: `work/independent-desktop/peekaboo-live-proof.json`. Screenshot pixels were not included in the evidence document.
- `independent/desktop-native-stop.swift` is independently authored preferred source for a macOS global listener with the existing public hotkey `ctrl+alt+cmd+escape`. Its real event-tap test received a synthesized native keyboard event, rather than directly invoking its callback. Evidence: `work/independent-desktop/native-stop-live-proof.jsonl`.
- `independent/desktop-native-stop.mjs` owns the listener process, refuses input after suspension or process exit, rejects implicit resume, and closes its process through stdin EOF. Actual Swift → host integration and refusal after stop passed: `work/independent-desktop/native-stop-host-proof.json`.
- Six regression tests passed for input authorization, argv boundaries, invalid receipts, bounded process output, abort/timeouts, native listener death, malformed state, forbidden automatic resume, and process cleanup.

## Required remaining work

- Isolate model-supplied JavaScript with a real sandbox and bounded CPU/memory. Node `vm` with injected host functions is not an acceptable security boundary.
- Complete the public computer API (including typing, pointer movement, capture/display behavior and error semantics), not merely these initial CLI methods.
- Connect session ownership, the native listener, read-only enforcement, audit storage, screenshot caps, explicit human resume and host shutdown to the replacement service.
- Test actual input in a disposable target, emergency stop during an outstanding operation, native helper failure, and parent-process death. Existing fixture tests do not prove those real cases.
- Provide reproducible helper compilation and distribution metadata, retain appropriate Peekaboo copyright/license notices, and test clean installation.
- Only then replace the active desktop imports/build, remove protected desktop source/binary from the public package, and rerun full independent/combined acceptance. No release or licensing clearance is claimed here.

## WASM execution verification

`independent/desktop-code.mjs` now executes model code in QuickJS WASM (`quickjs-emscripten` 0.32.0, MIT) with a separate runtime, bounded CPU/heap/stack and no Node globals or host-function constructor exposure. Four focused regressions establish async results, read-only rejection, host failure propagation, CPU interruption, actual heap exhaustion, abort forwarding, and serialization/settling of native operations. Ten desktop-component regressions pass in total. The actual WASM → Peekaboo → desktop screenshot path also passed (`work/independent-desktop/sandbox-live-proof.json`). The real native stop listener exited cleanly on host close (`work/independent-desktop/native-stop-close-proof.json`).

This is not yet a replacement for the full existing API. Black-box inspection of public method names additionally identified `capabilities`, `displays`, `windows`, `window`, `focusedWindow`, `elementAt`, `focusedElement`, `ref`, and nested clipboard read/write; these still require implementation and acceptance. The current independently authored adapter already adds double-click, pointer movement and text entry, but only fixture argument tests have exercised those input paths.

The previous standard regression run passed 614/614 (`/tmp/scrum-independent-desktop-components.log`). A subsequent full run including the WASM tests is in progress; do not substitute the earlier total for its result.

## Native observation and stop responsiveness

- Added independently authored `desktop-observe.swift` using macOS public CoreGraphics, AppKit and Accessibility APIs. It retrieves the full on-screen window inventory, display geometry, the focused window, hit-tested/focused accessibility elements, verified element references, and clipboard text. The clipboard write implementation exists but has not been exercised against the user's general clipboard.
- Actual window comparison passed: every one of the 43 IDs from the legacy snapshot was in the new 45-window snapshot; one window was focused and direct selection matched it. Evidence: `work/independent-desktop/observation-parity-proof.json`. These counts are snapshots, not a fixed inventory.
- Focused-element lookup initially failed through the system-wide object. It was corrected to query the frontmost application's Accessibility object. Actual focused and hit-tested references then resolved successfully. References include process launch identity, an ancestor/child path and a fingerprint, rejecting changed process generations or a different element. Evidence retains the initial failure and later success in `work/independent-desktop/ax-live-proof.jsonl`.
- The model execution moved to a worker thread. Shared atomic interruption lets the host react while the guest is CPU-bound. Real native emergency-hotkey input interrupted a running guest infinite loop in 3 ms after receipt; evidence: `work/independent-desktop/stop-during-cpu-proof.json`. A regression would fail if host timers were blocked.
- Peekaboo invocations now explicitly use `--no-remote`. Local permissions and actual capture passed; input must not be delegated to an unrelated bridge process that could outlive cancellation of the owned CLI.
- Capture now fits the existing 1600 × 1200 envelope while retaining aspect ratio (actual 1600 × 900). Bitmap data is delivered as image content, not embedded into the guest's return object. The public capture result retains target/frame ID, dimensions, source dimensions and scale. Image accumulation is bounded.
- Frame-coordinate conversion preserves display origins and validates capture age/current geometry before input. Fixture tests prove conversion, out-of-frame refusal, changed-display refusal and stale-reference refusal. Real frame-directed input remains a gate.

Fifteen focused component regressions passed. The remaining gates still include the independent session controller, complete target/background input semantics, actual input/clipboard mutation acceptance with restoration, capture target/crop behavior, audit persistence, preferred-source builds and package distribution. Legacy desktop imports remain active until those gates pass.

## Preferred-source build

`desktop-build.mjs` has been rewritten independently. It no longer bundles the OMO desktop packages or compiles the Senpi engine. It builds only the shipped Scrum Swift sources into an immutable generation under `vendor/desktop-independent`, records source/binary digests, compiler/SDK/target metadata, and atomically publishes a generation pointer. Source bytes are snapshotted before compilation. The first target-triple attempt failed; using the macOS SDK and the canonical `macosx` triple corrected it. Actual build evidence: `work/independent-desktop/build-proof.json`.

The legacy service/binary remain present and active until runtime/input parity gates close. Rebuilding the new helpers does not make that runtime replacement complete. New independent helpers are the preferred source for their own generated binaries; no old protected desktop implementation was used by this build.

## Independent session controller and background input acceptance

The independent controller now owns startup, global stop, cross-session input lease,
worker cancellation, image artifacts and append-only audit records. Closing or
stopping waits for native command cleanup before releasing the input lease.
Model code cannot replace trusted cancellation options with extra positional
arguments. The build loader verifies preferred Swift source hashes and native
binary hashes before execution.

`work/independent-desktop/background-click-proof.json` records a successful real
window acceptance run at 2026-10-10T18:54:54.373Z: one click, verified text entry,
verified key input, changed scroll offset, 19 drag events, and preserved foreground
window. This used an owned AppKit fixture, actual Peekaboo 4.9.0, native observer,
native emergency stop and independent session controller. The drag CLI requires
snapshot-only background targeting; a regression test rejects reintroduction of
explicit window targeting. The initial scroll fixture was positioned at its end;
placing it in the middle verified actual movement rather than accepting a receipt.

This is not full desktop parity or release approval. The old root desktop runtime
remains unchanged until remaining capture, AX interaction, capability and packaging
gates close. Peekaboo is optional so unsupported platforms can install Scrum.
Its bundled Swift compatibility library still requires a final license audit.

### Dependency audit evidence (not final clearance)

The installed npm Peekaboo 4.9.0 package includes its MIT license and an additional
`libswiftCompatibilitySpan.dylib` reporting Swift runtime version 6.4.0 through
Mach-O dependency metadata. The registry tarball integrity is
`sha512-SoZmJx/H5cQULwPR/ELvOcn+xoUWx8sY06p8ZGtCjX1qjo1U17tH0PuKK40itsSlT5plSAb/xqVD8QyAjbEq6w==`.
Swift's [official license](https://www.swift.org/legal/license.html) describes
Apache-2.0 with a runtime exception; the [upstream license text](https://github.com/swiftlang/swift/blob/main/LICENSE.txt)
specifies the exception for compiler-embedded portions. This does not itself prove
the provenance or redistribution conditions of this separately shipped dylib.
The pinned binary/source provenance and required notices remain a release gate.

## Current runtime state after scoped-API replacement

The worktree's `desktop.mjs` now delegates to the independent controller; it no
longer imports the protected service or Senpi binary. This has not been deployed
to the resident application. `npm pack --dry-run --ignore-scripts` confirmed zero
`vendor/desktop/` files in the draft package. Retired independent helper generations
were moved into excluded private evidence so only the current generation is shipped.

Read-only black-box probes of the original API identified scoped window capture,
window AX tree/search/ref/raise, and element value/bounds/attributes/actions/parent/
children/setValue/focus/perform/press/click. The independent guest now constructs
these handles entirely inside WASM; mutable RPC names are denied in read-only runs.
Read-only query arguments cannot override a native operation into `raise`.

Actual owned AppKit acceptance passed at 2026-10-10T19:14:31.245Z, including scoped
capture, search, AX tree, parent/children, attributes, available actions, values,
AXPress, focus and raise. Read-only setValue was rejected. Background click fallback
uses the containing window's capture receipt rather than global coordinates that
could hit an occluding window. Input errors distinguish proven nondispatch from
uncertain outcomes; uncertain outcomes require target-state verification and are
never automatically retried by the adapter.

The first real AX run exposed two independent bugs: unbundled AppKit processes have
no NSRunningApplication launchDate, and some AX children are not listed beneath
their reported parent. References now use native process birth identity and
validated attribute/child edges, retaining direct traversal paths for such nodes.
This preserves PID-reuse and stale-reference refusal without omitting these nodes.

Still required before release: parent-process-death cleanup for outstanding native
commands, remaining contract/limits comparison, full revised regression collection,
Peekaboo/runtime provenance and notices, clean installation and combined DSH release
acceptance. Root runtime replacement is not an assertion of complete licensing
clearance or full project completion.

### Parent-process lifetime gate repaired

The controlled baseline `parent-death-proof.json` demonstrated that the earlier
runner's child continued after its parent was killed. The new preferred-source
`desktop-command-guardian.swift` owns a separate child process group, treats
parent stdin EOF as cancellation, and kills remaining descendants on normal exit.
A separate control descriptor reports the owned group and is closed in the child.
The host and guardian both retain bounded cancellation/force-kill paths.

`parent-death-guarded-proof.json` passed at 2026-10-10T19:22:52.157Z. Three standard
native regressions also passed: command output/timeout, parent SIGKILL with both
child and grandchild ignoring SIGTERM, and normal-exit descendant cleanup. Real
scoped AX acceptance and all five background input actions passed again through
the guardian, at 19:24:27.857Z and 19:24:38.822Z respectively. No input was sent in
the parent-death fixture. This closes the tested parent-command lifetime defect;
it does not close the project's remaining license and functional-parity gates.

## Native reference replacement regression

The independent observer now records CFHash of the AX element in its scoped reference fingerprint. A real AppKit fixture replaces a button with identical title, identifier and bounds: the old reference is rejected, while a newly acquired reference resolves across helper invocations. The preferred fixture source is test-fixtures/desktop-input.swift; desktop-independent-element-identity-test.mjs passed. This establishes the tested replacement case, not a universal collision-free identity guarantee. The standard suite passed 639 tests, zero failures, cancellations or skips (91.999 seconds; /tmp/scrum-independent-desktop-identity-final-tests.log). Full migration and distribution clearance remain incomplete.
