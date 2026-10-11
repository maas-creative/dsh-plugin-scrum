# Records and discriminated states

Represent alternatives with a discriminating field and a union of valid records. Keep transport schemas separate when persisted compatibility requires different fields. Validate unknown input before constructing the domain record; readonly describes a type contract and does not recursively freeze runtime objects.

## Execution

```sh
bunx tsc --noEmit
```

Run commands from the appropriate project or skill directory and use the existing package manager when it differs.

## Acceptance

Test missing fields, unknown states and older persisted records. Distinguish absent values from empty strings and meaningful zero values. A merge must preserve identifiers and provenance instead of merely overwriting a record.

Official API reference: [Records and discriminated states](https://zod.dev/). The operational guidance is independently authored for Scrum.
