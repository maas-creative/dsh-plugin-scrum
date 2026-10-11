// Inline tool budgets remain independent of the host spill-store policy.
// Names include the established case-sensitive aliases for configured tools.
export const DEFAULT_MAX_TOKENS=50000;
export const WEBFETCH_MAX_TOKENS=10000;
export const TRUNCATABLE_TOOLS=Object.freeze(['grep','Grep','safe_grep','glob','Glob','safe_glob','lsp_diagnostics','interactive_bash','Interactive_bash','skill_mcp','webfetch','WebFetch']);
export const TOOL_SPECIFIC_MAX_TOKENS=Object.freeze({webfetch:WEBFETCH_MAX_TOKENS,WebFetch:WEBFETCH_MAX_TOKENS});
