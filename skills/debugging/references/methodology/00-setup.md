# Prepare a controlled reproduction

Identify the failing operation, expected output, affected build and most recent successful case. Capture the command, current directory, runtime version, relevant configuration, input shape and observed error. Use sanitized samples rather than credentials or unnecessary personal data. Check repository instructions before modifying files.

Create an owned temporary fixture or branch only when needed. Keep original logs and inputs immutable. Record which process, container or browser tab belongs to this investigation. Read-only inspection can proceed within the authorized task; changes to OS grants, production resources or external publication follow the host's permission rules. Inspect installed tools before planning around them.

First run the smallest faithful reproduction, then a representative end-to-end scenario. Record both successes and failures. Do not simplify away the timing, dependency, persistence or UI behavior responsible for the bug. Establish a rollback for persistent state before migrations. Treat inability to reproduce as a question to investigate, not evidence that the issue is fixed.
