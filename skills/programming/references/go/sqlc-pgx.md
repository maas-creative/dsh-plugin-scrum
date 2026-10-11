# SQL ownership and generated access

Keep schema migrations and named SQL queries in source control. sqlc generates typed access from queries; pgx handles PostgreSQL connections. Select configuration and API versions from the installed tools. Pass context into queries and use a transaction for related writes that must commit together.

## Execution

```sh
sqlc version
sqlc generate
go test ./...
```

## Acceptance

Verify generated changes in a clean working tree. Test a real database transaction rollback, cancellation and a constraint failure. Use parameters for values; do not concatenate user input into SQL identifiers. Distinguish a missing row from a connection failure.

Official API and version reference: [SQL ownership and generated access](https://github.com/sqlc-dev/sqlc). This operational guidance is independently authored for Scrum.
