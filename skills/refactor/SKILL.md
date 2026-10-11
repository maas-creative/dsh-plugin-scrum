---
name: refactor
description: Improve code structure while preserving required behavior and verifying callers.
---

# Refactor safely

Accept a target followed by --scope=file|module|project (default: module) and --strategy=safe|aggressive (default: safe). Keep the supplied arguments intact. File scope limits edits to the named file; module scope includes its direct contracts; project scope permits coordinated changes across the repository. Safe strategy preserves external behavior. Aggressive strategy may restructure internal contracts, but requires an explicit migration and rollback path and does not authorize unrelated product changes.

Build a codemap of the affected dependencies. Use available LSP references and definitions to locate callers, and AST queries for structural matches; verify their results against source rather than treating text matches as complete dependency coverage. Record a rollback checkpoint before destructive restructuring.

Define the structural problem and the behavior that must remain. Read the affected implementation, its callers, dependencies and relevant tests before choosing a change. Use repository instructions and preserve concurrent edits.

Prefer removing duplication or obsolete branches to adding new abstraction. Refactor around a concrete responsibility, not an arbitrary file length. Keep public contracts, persisted data and permission checks compatible unless the user explicitly requested a change.

Make the coherent change and update every affected caller. Verify the important behavior with existing tests; add a regression test when a concrete failure or risky boundary needs protection. Run the applicable build and type checks. Exercise data migration and rollback if stored state changes.

Review the final code for accidental behavior changes and unused compatibility layers. Report the resulting behavior, validation and remaining material risks. Do not claim preservation from a successful syntax check alone.

User authorization takes precedence over this workflow. Preserve the configured model; in this project use GPT 6.1 Sol with low reasoning. Do not create subagents when delegation is prohibited.
