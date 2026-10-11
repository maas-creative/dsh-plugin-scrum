#!/usr/bin/env python3
"""Scrum's independently implemented Python source-policy diagnostics."""
from __future__ import annotations

import ast
import io
import sys
import tokenize
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True, slots=True)
class Violation:
    rule: str
    file: Path
    line: int
    col: int
    message: str


def _name(node: ast.AST | None) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        return node.attr
    return ""


def _diagnostic(rule: str, file: Path, node: ast.AST) -> Violation:
    return Violation(rule, file, getattr(node, "lineno", 1),
                     getattr(node, "col_offset", 0) + 1, rule.replace("-", " "))


def discover_files(inputs: list[str]) -> list[Path]:
    found: set[Path] = set()
    for value in inputs:
        path = Path(value)
        if not path.exists():
            raise FileNotFoundError(value)
        if path.is_dir():
            found.update(p for p in path.rglob("*.py") if p.is_file()
                         and not any(part in {".venv", "venv", ".git", "__pycache__"}
                                     for part in p.parts))
        elif path.suffix == ".py":
            found.add(path)
    return sorted(found)


def is_any_node(node: ast.AST) -> bool:
    return _name(node) == "Any"


def is_cast_callable(node: ast.AST) -> bool:
    return _name(node) == "cast"


def find_node_violations(tree: ast.AST, file: Path) -> list[Violation]:
    return [_diagnostic("cast-any", file, node) for node in ast.walk(tree)
            if isinstance(node, ast.Call) and is_cast_callable(node.func)
            and node.args and is_any_node(node.args[0])]


def find_import_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    return []


def find_comment_violations(source: str, file: Path) -> list[Violation]:
    result = []
    for token in tokenize.generate_tokens(io.StringIO(source).readline):
        if token.type != tokenize.COMMENT:
            continue
        for label, rule in (("type: ignore", "type-ignore"), ("pyright: ignore", "pyright-ignore")):
            if label in token.string:
                result.append(Violation(rule, file, token.start[0], token.start[1] + 1,
                                        "Remove the type-check suppression."))
    return result


def _has_keyword(decorator_node: ast.AST, keyword: str) -> bool:
    return isinstance(decorator_node, ast.Call) and any(
        item.arg == keyword and isinstance(item.value, ast.Constant)
        and item.value.value is True for item in decorator_node.keywords)


def _is_dataclass_decorator(node: ast.AST) -> bool:
    return _name(node.func if isinstance(node, ast.Call) else node) == "dataclass"


def find_dataclass_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    result = []
    for node in ast.walk(tree):
        if isinstance(node, ast.ClassDef):
            for decorator in node.decorator_list:
                if _is_dataclass_decorator(decorator):
                    for keyword, rule in (("frozen", "mutable-dataclass"), ("slots", "missing-slots")):
                        if not _has_keyword(decorator, keyword):
                            result.append(_diagnostic(rule, file, decorator))
    return result


def find_dict_return_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    return []


def find_match_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    result = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Match):
            valid = any(isinstance(statement, ast.Expr)
                        and isinstance(statement.value, ast.Call)
                        and _name(statement.value.func) == "assert_never"
                        for case in node.cases for statement in case.body)
            if not valid:
                result.append(_diagnostic("missing-assert-never", file, node))
    return result


def find_generic_exception_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    return [_diagnostic("generic-exception", file, node) for node in ast.walk(tree)
            if isinstance(node, ast.Raise) and isinstance(node.exc, ast.Call)
            and _name(node.exc.func) in {"RuntimeError", "ValueError", "TypeError", "KeyError"}]


def _is_isinstance_test(node: ast.AST) -> bool:
    return isinstance(node, ast.Call) and _name(node.func) == "isinstance"


def _is_enum_comparison(node: ast.AST) -> bool:
    return isinstance(node, ast.Compare) and any(isinstance(value, ast.Attribute)
                                               for value in [node.left, *node.comparators])


def find_object_annotation_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    result = []
    for node in ast.walk(tree):
        annotation = (node.annotation if isinstance(node, (ast.arg, ast.AnnAssign))
                      else node.returns if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
                      else None)
        if annotation is not None:
            result.extend(_diagnostic("no-object", file, part) for part in ast.walk(annotation)
                          if isinstance(part, ast.Name) and part.id == "object")
    return sorted(result, key=lambda item: (item.line, item.col))


def find_if_elif_variant_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    return [_diagnostic("if-elif-on-variant", file, node) for node in ast.walk(tree)
            if isinstance(node, ast.If) and node.orelse and isinstance(node.orelse[0], ast.If)
            and (_is_isinstance_test(node.test) or _is_enum_comparison(node.test))]


def find_broad_except_violations(tree: ast.AST, source_lines: list[str], file: Path) -> list[Violation]:
    result = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.ExceptHandler):
            continue
        if node.type is None:
            result.append(_diagnostic("bare-except", file, node))
        if len(node.body) == 1:
            statement = node.body[0]
            if isinstance(statement, ast.Pass) or (isinstance(statement, ast.Expr)
                    and isinstance(statement.value, ast.Constant) and statement.value.value is Ellipsis):
                result.append(_diagnostic("silent-except", file, statement))
        if isinstance(node.type, ast.Name) and node.type.id in {"Exception", "BaseException"}:
            result.append(_diagnostic("broad-except", file, node))
    return result


def find_oversized_module_violations(source_lines: list[str], file: Path) -> list[Violation]:
    return [Violation("oversized-module", file, 1, 1, "Split the module by responsibility.")] if len(source_lines) > 250 else []


def check_file(file: Path) -> list[Violation]:
    source = file.read_text(encoding="utf-8")
    try:
        tree = ast.parse(source, filename=str(file))
    except SyntaxError as error:
        return [Violation("syntax-error", file, error.lineno or 1, error.offset or 1,
                          "Python could not parse this source.")]
    lines = source.splitlines()
    result = find_node_violations(tree, file)
    result.extend(find_comment_violations(source, file))
    for check in (find_dataclass_violations, find_match_violations,
                  find_generic_exception_violations, find_object_annotation_violations,
                  find_if_elif_variant_violations, find_broad_except_violations):
        result.extend(check(tree, lines, file))
    result.extend(find_oversized_module_violations(lines, file))
    return result


def main() -> int:
    if len(sys.argv) < 2:
        print("usage: check-no-excuse-rules.py <file-or-directory> ...", file=sys.stderr)
        return 2
    try:
        diagnostics = [item for path in discover_files(sys.argv[1:]) for item in check_file(path)]
    except (OSError, UnicodeError, tokenize.TokenError) as error:
        print(f"Source inspection failed: {error}", file=sys.stderr)
        return 2
    for item in diagnostics:
        print(f"{item.file}:{item.line}:{item.col}: {item.rule}: {item.message}", file=sys.stderr)
    if diagnostics:
        print(f"{len(diagnostics)} source-policy diagnostic(s).", file=sys.stderr)
    return 1 if diagnostics else 0


if __name__ == "__main__":
    raise SystemExit(main())
