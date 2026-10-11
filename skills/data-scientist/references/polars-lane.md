# Dataframes and SQL

Use Polars for explicit dataframe transformations and schema inspection. For large files, plan projection and filtering before materializing all columns. Choose lazy execution when it reduces unnecessary work, and check actual memory use rather than claiming that a file is small enough.

Validate types before arithmetic and joins. Dates, numeric strings, identifiers with leading zeros, categories and nulls need intentional handling. Preserve identifier semantics. Check join cardinality and unmatched records; unexpected row multiplication can invalidate totals even when the command succeeds.

The included quick-query helper uses Polars for descriptive statistics and SQL-filter expressions. Its SQL query path uses DuckDB's native file readers, preserving DuckDB's type inference, including CSV dates. Do not assume the two engines infer every type identically. Compare schemas and cast deliberately when mixing engines.

Examples:

```sh
python3 scripts/quick-query.py input.csv --describe
python3 scripts/quick-query.py input.parquet 'SELECT name, amount FROM data WHERE amount > 100'
python3 scripts/quick-query.py input.ndjson --filter 'amount > 100'
```

These paths are relative to the data-scientist skill directory. Use the actual installed script path when running elsewhere. All rows are printed by the helper; for large exploratory results, write an explicit bounded SQL query or use a project analysis script. Do not silently truncate a final analytical result.

Check aggregation denominators, missing-value behavior, grouping keys and ordering. Cross-check important totals using another independent calculation or a known source total. Keep a failing comparison as a finding until its cause is resolved; do not adjust expected values merely to obtain passing tests.
