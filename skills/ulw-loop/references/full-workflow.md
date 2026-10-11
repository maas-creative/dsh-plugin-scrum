# Execution and recovery

1. Read status. If no saved plan exists, create it from the authorized brief. If a plan exists, inspect it and preserve completed evidence.
2. Use complete-goals to acquire the next pending goal or resume the active one. Read criteria for that goal. The returned goal is work to perform, not a completion receipt.
3. Implement the required output. If delegation is explicitly allowed, collect and verify the worker's artifacts before recording progress. Do not stop monitoring merely because a worker acknowledged its assignment.
4. Use record-evidence with goalId, criterionId, status, and concrete evidence. Essential passing criteria require actual output inspection or executed checks. Failure evidence remains valuable and must not be converted to pass without revalidation.
5. Record discovered review blockers using record-review-blockers. Resolve them and clear the list only after verification. checkpoint requires a goalId, status, and evidence; complete is rejected while essential evidence or blockers remain unresolved.
6. Inspect status after checkpointing. Continue with remaining goals. If new evidence invalidates a completed output, record the failure; re-opened work must be repaired and checked again.
7. After interruption, inspect saved status and evidence, reconcile current artifacts, and resume the outstanding goal. Persisted events and projections support recovery; do not manually rewrite the ledger or duplicate work based on a stale message.
8. End only after the entire authorized outcome is verified, required delivery and cleanup finish, and no unresolved goal or blocker remains. Respect an explicit stop immediately and retain the incomplete state for an authorized resume.
