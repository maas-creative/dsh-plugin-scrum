# Scrum 0.7.0 independent replacement release audit

The implementation and scoped acceptance work covers the OMO-derived runtime, prompts, skills and desktop assets. Independent replacements retain public interfaces and saved-state contracts; separately acquired OSS retains its own notices. The pinned reference is `59d23b5c1ddc2a02210ede4cb485f88996fd02bd` (Sustainable Use License). Protected snapshots and their runtime imports are excluded from public distribution.

## Results

- 729 standard regression tests passed, with no failures, skips or cancellations.
- The cleanly installed package loads in real DSH as Scrum alone, Dashboard then Scrum, and Scrum then Dashboard. Ordinary tasks, HardTackle/compatibility commands, stopping and observational lifecycle status work while business records remain Dashboard-owned.
- Six bundled runtimes rebuilt from shipped preferred sources and matched byte-for-byte. Native Swift preferred source/build identity is verified separately; platform Mach-O bit-for-bit reproduction is not asserted.
- GPT 6.1 Sol low performed planning, two worker delegations, result collection, independent artifact content/hash checks, DAG reconciliation and resource cleanup. The same fixed package passed both Dashboard/HardTackle and standalone ordinary-mode cases.
- Actual Dashboard task linkage rejects completion before independent Scrum verification, then reflects accepted completion. The isolated deadline/submission sentinel rows remained unchanged. Resident business data was not modified.
- Package overlap and public-repository overlap (including tests and documents) have explicit source/license or persisted-interface classifications. These are engineering provenance findings, not a formal clean-room or unconditional legal guarantee.

See [machine-readable evidence](independent-release-evidence.json), [replacement inventory](independent-implementation-inventory.json), [notices](../THIRD_PARTY_NOTICES.md) and [license scope](../NOTICE.md).

## Distribution and scope

MaaS Creative distributes independently authored Scrum source as AGPL-3.0-only; third-party components retain their licenses. Registry-installed Sharp/libvips and LibreOffice components are not vendored into the Scrum tarball. Redistributing a bundled installation must preserve their own source/notice obligations too.

This acceptance targets the current macOS arm64 host. Windows installer sources and platform-selection fixtures are present, but native execution on every platform is not claimed. Optional third-party authentication and paid API accounts are not inferred from a model catalog or onboarding marker.

The candidate is an immutable local package, not a GitHub/npm publication or resident deployment. No 24-hour trial was performed. For an older installation whose updater understands only historical license-path descriptors, use a package-manager installation; legacy metadata migration was tested with the new updater, not retroactively changed old code.

Earlier migration documents are historical checkpoints. Their old remaining-work lists do not describe this candidate. The final evidence document and inventory define the current engineering acceptance scope.
