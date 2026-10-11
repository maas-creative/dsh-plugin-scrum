"""Independent, read-only Rust source-policy checks for Scrum."""
from __future__ import annotations
import re
import sys
from pathlib import Path


def inspect(path: Path) -> list[tuple[str, int]]:
    lines = path.read_text(encoding="utf-8").splitlines()
    findings: list[tuple[str, int]] = []
    depth = 0
    test_depth: int | None = None
    pending_test = False
    for index, original in enumerate(lines):
        line = original.split("//", 1)[0]
        if re.search(r"#\s*\[\s*cfg\s*\(\s*test\s*\)\s*\]", line):
            pending_test = True
        if pending_test and re.search(r"\bmod\s+\w+\s*\{", line):
            test_depth = depth
            pending_test = False
        inside_test = test_depth is not None
        if re.search(r"#\s*\[\s*allow\s*\(", line):
            findings.append(("allow-attribute", index + 1))
        if re.search(r"#\s*\[\s*expect\s*\(", line) and not re.search(r'\breason\s*=\s*"[^"\n]+"', line):
            findings.append(("expect-without-reason", index + 1))
        if not inside_test:
            if re.search(r"\.\s*unwrap\s*\(", line):
                findings.append(("unwrap", index + 1))
            if re.search(r"\.\s*expect\s*\(", line):
                previous = lines[index - 1] if index else ""
                allowed = re.search(r"#\s*\[\s*expect\s*\(\s*clippy::expect_used\s*,", previous)
                reason = re.search(r'\breason\s*=\s*"[^"\n]+"', previous)
                if not (allowed and reason):
                    findings.append(("expect", index + 1))
        if re.search(r"\b(?:todo|unimplemented|unreachable)\s*!", line):
            findings.append(("placeholder-macro", index + 1))
        if re.search(r"\bunsafe\s*\{", line):
            context = lines[max(0, index - 5):index + 1]
            if not any(re.search(r"//\s*SAFETY:", value) for value in context):
                findings.append(("unsafe-no-safety-comment", index + 1))
        depth += line.count("{") - line.count("}")
        if test_depth is not None and depth <= test_depth:
            test_depth = None
    return findings


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
                files.update(p for p in path.rglob("*.rs") if p.is_file() and "target" not in p.parts)
            elif path.suffix == ".rs":
                files.add(path)
        count = 0
        for path in sorted(files):
            for rule, line in inspect(path):
                print(f"::error file={path},line={line}::[{rule}] Rust source policy requires review.", file=sys.stderr)
                count += 1
        if count:
            print(f"{count} Rust source-policy diagnostic(s).", file=sys.stderr)
        return 1 if count else 0
    except (OSError, UnicodeError) as error:
        print(f"Rust source inspection failed: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
