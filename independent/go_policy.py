"""Independent read-only Go source-policy CLI for Scrum."""
from __future__ import annotations
import re
import sys
from pathlib import Path


def inspect(path: Path) -> list[tuple[str, int]]:
    result: list[tuple[str, int]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if re.search(r"//\s*nolint\b", line):
            reason = re.search(r"//\s*nolint\b[^\n]*?//\s*(\S.*)", line)
            if reason is None:
                result.append(("nolint-no-reason", number))
        if re.search(r"\b(?:TODO|FIXME)\b", line) and not re.search(r"\b(?:TODO|FIXME)\s*\([^)]*\)", line):
            result.append(("todo-no-owner", number))
        code = line.split("//", 1)[0]
        if "interface{}" in code:
            result.append(("old-interface-empty", number))
    return result


def main(arguments: list[str]) -> int:
    if not arguments:
        print("usage: check-no-excuse-rules.sh <file-or-directory> ...", file=sys.stderr)
        return 2
    try:
        files: set[Path] = set()
        for value in arguments:
            path = Path(value)
            if not path.exists():
                raise FileNotFoundError(value)
            if path.is_dir():
                files.update(p for p in path.rglob("*.go") if p.is_file() and "vendor" not in p.parts)
            elif path.suffix == ".go":
                files.add(path)
        count = 0
        for path in sorted(files):
            for rule, line in inspect(path):
                print(f"::error file={path},line={line}::[{rule}] Go source policy requires review.", file=sys.stderr)
                count += 1
        if count:
            print(f"{count} Go source-policy diagnostic(s).", file=sys.stderr)
        return 1 if count else 0
    except (OSError, UnicodeError) as error:
        print(f"Go source inspection failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
