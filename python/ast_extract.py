#!/usr/bin/env python3
"""Deterministic Python AST facts for todo2code. Uses only the Python standard library."""
from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import sys
from pathlib import Path
from typing import Any

IGNORED_DIRS = {'.git', 'node_modules', 'dist', 'build', 'coverage', '.intent', '.venv', 'venv', '__pycache__'}


def source_hash(value: str) -> str:
    return hashlib.sha256(value.encode('utf-8')).hexdigest()


def dotted_name(node: ast.AST) -> str:
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        left = dotted_name(node.value)
        return f'{left}.{node.attr}' if left else node.attr
    if isinstance(node, ast.Call):
        return dotted_name(node.func)
    return ''


class FactVisitor(ast.NodeVisitor):
    def __init__(self, relative_path: str, lines: list[str]) -> None:
        self.relative_path = relative_path
        self.lines = lines
        self.scope: list[str] = []
        self.facts: list[dict[str, Any]] = []

    def excerpt(self, node: ast.AST) -> str:
        start = max(1, getattr(node, 'lineno', 1))
        end = max(start, getattr(node, 'end_lineno', start))
        return '\n'.join(self.lines[start - 1:min(end, len(self.lines))])[:2000]

    def add(self, node: ast.AST, kind: str, action: str, obj: str, symbol: str | None = None, metadata: dict[str, Any] | None = None) -> None:
        start = max(1, getattr(node, 'lineno', 1))
        end = max(start, getattr(node, 'end_lineno', start))
        excerpt = self.excerpt(node)
        self.facts.append({
            'path': self.relative_path,
            'lineStart': start,
            'lineEnd': end,
            'kind': kind,
            'action': action,
            'object': obj or 'unknown',
            'symbol': symbol,
            'subject': '.'.join(self.scope) if self.scope else None,
            'excerpt': excerpt,
            'contentHash': source_hash(excerpt),
            'metadata': metadata or {},
        })

    def visit_Import(self, node: ast.Import) -> Any:
        for alias in node.names:
            self.add(node, 'python_import_fact', 'depend_on', alias.name, metadata={'alias': alias.asname})
        self.generic_visit(node)

    def visit_ImportFrom(self, node: ast.ImportFrom) -> Any:
        module = node.module or ''
        for alias in node.names:
            name = f'{module}.{alias.name}'.strip('.')
            self.add(node, 'python_import_fact', 'depend_on', name, metadata={'alias': alias.asname, 'level': node.level})
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef) -> Any:
        self.add(node, 'python_symbol_fact', 'declare', node.name, symbol=node.name, metadata={
            'symbolKind': 'function',
            'async': False,
            'decorators': [dotted_name(item) for item in node.decorator_list],
            'arguments': [item.arg for item in node.args.args],
        })
        self.scope.append(node.name)
        self.generic_visit(node)
        self.scope.pop()

    def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef) -> Any:
        self.add(node, 'python_symbol_fact', 'declare', node.name, symbol=node.name, metadata={
            'symbolKind': 'function',
            'async': True,
            'decorators': [dotted_name(item) for item in node.decorator_list],
            'arguments': [item.arg for item in node.args.args],
        })
        self.scope.append(node.name)
        self.generic_visit(node)
        self.scope.pop()

    def visit_ClassDef(self, node: ast.ClassDef) -> Any:
        self.add(node, 'python_symbol_fact', 'declare', node.name, symbol=node.name, metadata={
            'symbolKind': 'class',
            'bases': [dotted_name(item) for item in node.bases],
            'decorators': [dotted_name(item) for item in node.decorator_list],
        })
        self.scope.append(node.name)
        self.generic_visit(node)
        self.scope.pop()

    def visit_Call(self, node: ast.Call) -> Any:
        callee = dotted_name(node.func)
        if callee:
            self.add(node, 'python_call_fact', 'call', callee, symbol='.'.join(self.scope) or None, metadata={'callee': callee})
        self.generic_visit(node)


def iter_python_files(root: Path, files_from: Path | None = None) -> list[Path]:
    if files_from is not None:
        values = json.loads(files_from.read_text(encoding='utf-8'))
        if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
            raise ValueError('--files-from must contain a JSON array of paths')
        output: list[Path] = []
        for value in values:
            candidate = (root / value).resolve()
            try:
                candidate.relative_to(root)
            except ValueError as exc:
                raise ValueError(f'Python source escapes root: {value}') from exc
            if candidate.suffix == '.py' and candidate.is_file() and not candidate.is_symlink():
                output.append(candidate)
        return sorted(set(output))

    output: list[Path] = []
    for current, directories, files in os.walk(root):
        directories[:] = sorted(directory for directory in directories if directory not in IGNORED_DIRS)
        for filename in sorted(files):
            if filename.endswith('.py'):
                candidate = Path(current) / filename
                if not candidate.is_symlink():
                    output.append(candidate)
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('root')
    parser.add_argument('--max-file-bytes', type=int, default=524288)
    parser.add_argument('--files-from', type=Path)
    args = parser.parse_args()
    root = Path(args.root).resolve()
    facts: list[dict[str, Any]] = []
    warnings: list[str] = []
    for file_path in iter_python_files(root, args.files_from):
        try:
            if file_path.stat().st_size > args.max_file_bytes:
                warnings.append(f'skipped oversized Python file: {file_path.relative_to(root)}')
                continue
            body = file_path.read_text(encoding='utf-8')
            tree = ast.parse(body, filename=str(file_path), type_comments=True)
            visitor = FactVisitor(file_path.relative_to(root).as_posix(), body.splitlines())
            visitor.visit(tree)
            facts.extend(visitor.facts)
        except (SyntaxError, UnicodeDecodeError, OSError) as exc:
            warnings.append(f'{file_path.relative_to(root)}: {exc}')
    print(json.dumps({'facts': facts, 'warnings': warnings}, ensure_ascii=False, sort_keys=True))
    return 0


if __name__ == '__main__':
    sys.exit(main())
