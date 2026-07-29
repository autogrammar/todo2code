#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import sys
import zipfile
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1] if len(sys.argv) > 1 else 'todo2code.zip').resolve()
ignored_dirs = {'.git', 'node_modules', 'coverage', '.intent', '.intent-demo', '.intent-test', '__pycache__'}
ignored_names = {'.env', out.name}
with zipfile.ZipFile(out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for item in sorted(root.rglob('*')):
        relative = item.relative_to(root)
        if any(part in ignored_dirs for part in relative.parts):
            continue
        if item.name in ignored_names or item.is_dir():
            continue
        archive.write(item, Path('todo2code') / relative)
digest = hashlib.sha256(out.read_bytes()).hexdigest()
checksum = out.with_name(out.name + '.sha256')
checksum.write_text(f'{digest}  {out.name}\n', encoding='utf-8')
print(out)
print(checksum)
