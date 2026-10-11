# Questions for an unsafe Rust boundary

## Ownership and lifetime

For every pointer, identify the allocation owner, the allocation size and the last permitted use. A raw pointer does not extend the allocation's lifetime. Check that cleanup cannot free the allocation twice, that a returned reference cannot outlive its storage and that an FFI caller cannot retain a borrowed buffer after the call.

## Initialization and representation

Determine which bytes are initialized before reading them and whether the resulting value is valid for its Rust type. Capacity is not initialized length. A layout assumption needs an explicit representation contract; matching size alone does not establish that two types can be converted safely. Check alignment before dereferencing a pointer.

## Aliasing and concurrency

Describe who may read or mutate each location while a reference exists. A mutex protects only code paths that actually use it. An unsafe Send or Sync implementation needs an argument covering every accessible field and operation. Check callbacks, reentrancy and concurrent destruction as well as the normal call.

## Failure paths

Review partial initialization, allocation failure, panic, cancellation and FFI errors. Cleanup must use the set of resources actually acquired. A catch around a panic is not a substitute for a valid memory state. Never expose an object whose constructor failed to establish its invariant.

## Acceptance

Write a safe wrapper that rejects invalid inputs before entering unsafe code. Exercise zero length, boundary length, overlapping buffers, early exit and repeated cleanup where relevant. Retain the invariant explanation next to the operation and link it to meaningful tests. The authoritative language rules are in the [Rust Reference](https://doc.rust-lang.org/reference/behavior-considered-undefined.html); this checklist is Scrum's own review guidance.
