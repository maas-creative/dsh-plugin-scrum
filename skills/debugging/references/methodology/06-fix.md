# Repair the violated contract

Add a regression that reproduces the observed failure before changing behavior when the risk justifies a test. Fix the earliest responsible boundary shared by affected callers. Preserve valid inputs, persisted identifiers, records, ownership and cancellation semantics. Avoid broad rewrites unless the defect arises from the structure itself.

Trace callers after the change. Exercise malformed input, repeated requests, concurrent ownership and restart when they reach the repaired path. Validate transformed inputs after hooks or adapters; a change in representation must not bypass authorization or schema checks. Clean up only owned resources and retain failed cleanup for retry when necessary.

Review the change against correctness, data loss, concurrency, meaningful tests and unnecessary complexity. Keep the repair and its evidence reviewable. Passing a narrow regression advances the investigation but does not replace the user's overall acceptance criteria.
