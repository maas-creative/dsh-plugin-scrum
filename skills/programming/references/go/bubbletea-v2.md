# Terminal UI with Bubble Tea

Pin the installed major version and consult its upgrade guide before copying API names from an older tutorial. Treat the UI model as the visible state, incoming messages as events and commands as asynchronous work. Keep network and filesystem operations out of rendering. Retain operation IDs so a late response cannot overwrite the current selection.

## Execution

```sh
go list -m all
go test ./...
```

## Acceptance

Exercise resizing, keyboard focus, cancellation and an error response in a real terminal. Keep long text bounded or scrollable. Restore terminal state on exit and verify that subprocesses belong to the UI operation before terminating them.

Official API and version reference: [Terminal UI with Bubble Tea](https://github.com/charmbracelet/bubbletea). This operational guidance is independently authored for Scrum.
