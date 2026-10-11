#!/usr/bin/env python3
"""Independent file query CLI; external dataframe engines are loaded on demand."""
import argparse
from pathlib import Path
import sys


def load_frame(path):
    import polars as pl
    suffix = path.suffix.lower()
    readers = {'.csv': pl.read_csv, '.parquet': pl.read_parquet,
               '.json': pl.read_json, '.ndjson': pl.read_ndjson, '.jsonl': pl.read_ndjson}
    if suffix not in readers:
        raise ValueError('Unsupported file format: ' + suffix)
    return readers[suffix](path)


def print_frame(frame):
    try:
        from rich.console import Console
        from rich.table import Table
    except ImportError:
        print('\t'.join(frame.columns))
        for row in frame.iter_rows():
            print('\t'.join(str(value) for value in row))
    else:
        table = Table()
        for name in frame.columns:
            table.add_column(name)
        for row in frame.iter_rows():
            table.add_row(*(str(value) for value in row))
        Console().print(table)
    print('{} rows × {} cols'.format(frame.height, frame.width))


def query(path, sql=None, filter_expr=None, describe=False):
    import polars as pl
    frame = load_frame(path) if describe or filter_expr or not sql else None
    if describe or (not filter_expr and not sql):
        print('\nSchema: {} ({} rows × {} cols)'.format(path.name, frame.height, frame.width))
        for name, dtype in frame.schema.items():
            print('  {}: {}'.format(name, dtype))
        print('\nStatistics:')
        result = frame.describe()
    elif filter_expr:
        context = pl.SQLContext(data=frame, eager=True)
        result = context.execute('SELECT * FROM data WHERE ' + filter_expr)
    else:
        import duckdb
        with duckdb.connect(':memory:') as connection:
            readers = {'.csv': connection.read_csv, '.parquet': connection.read_parquet,
                       '.json': connection.read_json, '.ndjson': connection.read_json, '.jsonl': connection.read_json}
            reader = readers.get(path.suffix.lower())
            if reader is None:
                raise ValueError('Unsupported file format: ' + path.suffix)
            reader(str(path)).create_view('data')
            cursor = connection.execute(sql)
            export = getattr(cursor, 'to_arrow_table', None) or cursor.fetch_arrow_table
            result = pl.from_arrow(export())
    print_frame(result)
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description='Query CSV, Parquet, JSON or NDJSON using table data.')
    parser.add_argument('file', type=Path)
    parser.add_argument('sql', nargs='?', help="DuckDB SQL; the input table is named 'data'.")
    parser.add_argument('--filter', '-f', dest='filter_expr', help='Polars SQL filter expression')
    parser.add_argument('--describe', '-d', action='store_true', help='Print schema and descriptive statistics')
    args = parser.parse_args(argv)
    try:
        if not args.file.is_file():
            raise ValueError('Data file does not exist: ' + str(args.file))
        query(args.file, args.sql, args.filter_expr, args.describe)
    except Exception as error:
        print('Data query failed: ' + str(error), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
