# Review warning signs

Review a concrete path from user input to durable output. A warning sign becomes a finding only when an actual caller and input can demonstrate the failure. Apply these checks to the changed behavior rather than redesigning unrelated modules.

## Incorrect success

An exception swallowed into an empty list can make the UI show no work when retrieval actually failed. Preserve a distinct failure state and enough context to retry safely. An accepted queue message is not delivery, and a worker's exit is not artifact acceptance. Test these state transitions at their actual owner.

## Unclear ownership

Every process, temporary directory, stream and subscription needs an owner and an exit path. A global cleanup operation is unsafe when another project shares the host. Name resources by their owner, close them on cancellation and test that unrelated resources survive cleanup.

## Persistent-state shortcuts

Read-modify-write without a transaction can lose another writer's changes. A retry without an idempotency key can duplicate a submission or progress update. Reproduce concurrent or repeated requests and verify both the final record and the side effect. Do not infer durability from an in-memory acknowledgement.

## Excessive abstraction

Trace whether an abstraction has multiple real consumers and a meaningful boundary. A wrapper that only forwards identical arguments may hide an error without adding policy. Prefer the standard library or an existing repository helper when it already implements the contract. Split modules by responsibility, not by an arbitrary line count.

## False confidence from tests

A mock returning the exact object expected by the implementation proves little about the external API. Keep a focused failure regression, then exercise the real parser, SDK, storage or UI when the change crosses that boundary. Record which environment and API version were used. Never label unexecuted checks as passed.

## Change review

Check validation after any hook changes the input. Recheck permissions at execution, not only at planning. Follow errors back to the user-visible state. Verify that old records still load and that new optional fields do not erase existing data. Report unresolved cases explicitly and keep working on the requested completion conditions.
