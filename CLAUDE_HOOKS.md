# Explicit Claude-style hooks

Hooks are disabled by default. Configure `claudeHooks.enabled: true` and either an inline `hooks` object or an explicit `path` to a settings JSON file containing `hooks`. With `settings: true`, user, project and local `.claude` settings are also loaded, along with enabled installed Claude plugins. `plugins: false` disables installed-plugin discovery; `plugins: true` enables it independently of settings discovery. Project-scoped plugins use the configured `cwd`, and each action receives its own `CLAUDE_PLUGIN_ROOT`. Reload re-evaluates installed plugins and enabled settings.

Native hook payloads include `transcript_path`, a private JSONL projection of the current public DSH message history. Tool calls and results retain their correlation IDs; opaque provider reasoning data is omitted. The projection does not modify the native session and is rebuilt after history changes or resume.

```yaml
claudeHooks:
  enabled: true
  hooks:
    PreToolUse:
      - matcher: Bash|Write*
        hooks:
          - type: command
            command: 'node /absolute/admin/hooks/check.mjs'
            timeout: 30
            allowedEnvVars: [PATH]
    PostToolUse:
      - matcher: '*'
        hooks:
          - type: http
            url: https://hooks.example.test/tool-result
            headers:
              Authorization: 'Bearer $HOOK_TOKEN'
            allowedEnvVars: [HOOK_TOKEN]
```

Supported mappings use public DSH SDK events:

| Claude event | DSH event | Behavior |
| --- | --- | --- |
| PreToolUse | tools/pre-execute | Exit 2 or JSON deny/block denies. Exit 1 or JSON ask requests native review. Allow/approve cannot override a prior native deny, ask, or cancel. |
| PostToolUse | tools/post-execute | Exit 2 attaches warning context; the executed tool remains executed. JSON block returns corrective error feedback. |
| PostToolUseFailure | tools/post-execute | Runs for failed dispatch results and never converts failure into successful execution. |
| UserPromptSubmit | agent/pre-step | Runs only for admitted messages with human `user` provenance. Block/exit 2 rejects the proposed step; coordinator and worker prompts do not trigger it. |
| Stop | agent/turn-stopping | Block/exit 2 injects corrective nonhuman context to keep the same turn open, once per human prompt. The next boundary receives `stop_hook_active: true`; further continuation is suppressed. |

Command hooks receive one JSON object on stdin and the owning session's working directory. Tool names follow the upstream Claude-style PascalCase mapping, and tool inputs/responses use snake_case field names. Inputs contain `session_id`, `cwd`, `hook_event_name`, relevant event fields, `permission_mode: default`, and `hook_source: dsh-scrum-plugin`. `CLAUDE_PROJECT_DIR`, `HOME`, and optional `CLAUDE_PLUGIN_ROOT` are set for commands. Without `allowedEnvVars`, command hooks inherit the environment; with it, only listed variables plus normalized HOME/PATH/project/plugin variables are passed. The shell expands project/plugin variables normally. The default timeout is 30 seconds. Cancellation kills the process group on Unix. Captured output and HTTP bodies are bounded to 1 MB.

HTTP hooks POST the same JSON with `Content-Type: application/json`. Header substitutions expand only listed environment variables. HTTPS is required except loopback HTTP. Redirects are not followed. A successful JSON response's numeric `exitCode` is honored; other successful bodies use exit 0. Transport/non-success HTTP responses use exit 1.

`hookSpecificOutput.additionalContext`, plaintext post/user hook output, warnings, and `systemMessage` become logged nonhuman context. `continue: false` cancels the pending tool, rejects prompt admission, or cancels the active turn as applicable. Hook block reasons and warnings are logged; this adapter does not impersonate a human message.

PreToolUse `updatedInput` is dispatched as a nested DSH call. The original body does not run; the replacement passes native schema, policy and guards. Synthetic session records retain original/replacement inputs, root/nested call IDs and settlement status. PostToolUse receives replacement input once. The original model call remains intact in history.

PermissionRequest supports one-call allow/deny; its `updatedInput` replaces the input and is redispatched through DSH schema validation and native permission guards. `updatedPermissions` validates rule, mode and directory entries and applies session/user/project/local settings updates while preserving unrelated settings. Deny and ask rules take priority over allow; native DSH tool visibility and monotonic guards remain effective. Auto mode requires the native DSH Auto provider; bypass mode is ineffective unless explicitly enabled and is never written as a persistent default. Session permission receipts restore only for their owning session after resume. Additional directories are reflected in the shared native filesystem and kernel writable-root policy; removal revokes both, while native read-only confinement stays unchanged. This requires the pinned DSH directory compatibility adapter installed by the package. Native macOS acceptance covers grants, revocation, owner isolation and symlink escape denial. Full mode and all-event acceptance remains in progress. `suppressOutput` cannot erase durable events. The `transcript_path` projection comes from public native history; no todo file is fabricated. Notification, SubagentStart/Stop, SessionStart/End and PreCompact have registered execution paths; PreCompact requires the Scrum compaction provider. Stop uses bounded corrective injection. Real DSH acceptance verifies successive hooks receive prior updates, updates accumulate without dropping original arguments, snake_case hook keys map to existing native camelCase keys, and cancellation before replacement prevents the body. Cancellation during a running tool and persistent permission changes remain outside this acceptance.
