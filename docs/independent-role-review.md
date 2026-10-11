What this change does: Replaces the OMO role prompt generator dependency with Scrum-authored instructions. Keeps persisted role identifiers and existing role/configuration enforcement.

Checked: roleInstruction and rolePolicy callers, configured overrides, alias resolution, seven upstream built-in identifiers, fixed model instruction and project acceptance boundary. Connected regression tests passed.

Must fix before public release: The rest of the package still contains OMO-derived implementation and skill text. Keeping compatibility identifiers does not clear those rights. The inventory records this migration as incomplete.

Verdict: Do not publish the whole package as AGPL yet.
