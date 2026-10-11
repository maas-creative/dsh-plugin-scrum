# Types should express a contract

Define small interfaces at the consumer when more than one implementation is needed. Keep concrete types when an interface only obscures the implementation. Use distinct named types for values with different units or identities. Generics should remove real duplication without hiding domain validation.

## Execution

```sh
go test ./...
go vet ./...
```

## Acceptance

Check typed nil values returned through interfaces and the zero-value behavior of exported types. Ensure a constructor does not publish a partially valid record. For variant states, make permitted transitions explicit and test invalid combinations.

Official API and version reference: [Types should express a contract](https://go.dev/ref/spec). This operational guidance is independently authored for Scrum.
