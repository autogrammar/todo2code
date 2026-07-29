#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from sdk.python import Todo2CodeClient  # noqa: E402


if len(sys.argv) != 3:
    raise SystemExit("Usage: python3 examples/sdk/python.py before.graph.json after.graph.json")

with open(sys.argv[1], encoding="utf-8") as before_file:
    before_graph = json.load(before_file)
with open(sys.argv[2], encoding="utf-8") as after_file:
    after_graph = json.load(after_file)

client = Todo2CodeClient(os.getenv("T2C_URL", "http://127.0.0.1:8787"))
result = client.diff_graphs(before_graph, after_graph, include_svg=False)
print(json.dumps(result["diff"]["summary"], indent=2))
