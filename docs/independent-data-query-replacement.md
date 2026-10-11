# Independent data-query implementation

The public `skills/data-scientist/scripts/quick-query.py` entry point now runs independently authored `independent/data-query.py`. The previous implementation is retained only in private work evidence, outside the npm runtime package.

The CLI keeps a file argument, optional DuckDB SQL against table `data`, `--filter`/`-f` for Polars SQL expressions, and `--describe`/`-d`. CSV, Parquet, JSON, NDJSON and JSONL are supported. With no query, it prints schema and descriptive statistics. SQL loads through the native DuckDB file reader and registers its relation, so the input filename is not interpolated into SQL. Engine errors are reported without dumping implementation source. Help and missing-file validation work without dataframe dependencies.

Use a Python environment with Polars, DuckDB and PyArrow installed. Rich is optional for table rendering. The current integration proof used Python 3.12.12, Polars 2.0.0, DuckDB 1.5.6, PyArrow 25.0.1 and Rich 15.0.0. Other engine releases have not been fully validated. The command does not install dependencies or modify the user's environment automatically.

Examples from the package root:

```sh
python3 skills/data-scientist/scripts/quick-query.py sample.csv --describe
python3 skills/data-scientist/scripts/quick-query.py sample.parquet 'SELECT * FROM data WHERE amount > 100'
python3 skills/data-scientist/scripts/quick-query.py sample.ndjson --filter 'amount > 100'
```

The ordinary test command covers dependency-free CLI loading, missing-file handling, and real-engine regressions for all five formats, aggregates, quoted filenames and CSV date arithmetic. The engine test uses SCRUM_DATA_QUERY_PYTHON if provided, then the prepared private development environment if present, then python3. Install the documented engine dependencies in the selected environment before running npm test; the test does not install dependencies or silently skip unavailable engines. Separately recorded real-engine integration proof compares synthetic data in five formats across description, SQL and filter modes: the initial 15 output comparisons match. This is evidence for those cases, not a claim that every SQL dialect operation, malformed file or engine version has equivalent behavior.

The data-scientist skill's remaining documentation, dependency installers and setup scripts are not yet replaced. This change does not establish completion of the complete skill or the broader independent-implementation goal.
