# Model domain records

Use structs with named fields for durable records and distinguish transport models from domain invariants. Validate identifiers, states and units at creation. Represent absent values separately when the zero value is meaningful. Schema changes need an explicit migration and compatibility strategy, not just a renamed Go field.

## Execution

```sh
go test ./...
```

## Acceptance

Test old serialized records, missing fields, unknown enum values and invalid state transitions. Preserve original identifiers across a merge or retry. Do not use a map of arbitrary values to bypass a known record schema.

Official API and version reference: [Model domain records](https://go.dev/ref/spec). This operational guidance is independently authored for Scrum.
