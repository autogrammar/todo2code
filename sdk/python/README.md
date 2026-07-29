# todo2code Python SDK

Instalacja lokalna:

```bash
python3 -m pip install ./sdk/python
```

Użycie:

```python
import json
from todo2code_sdk import Todo2CodeClient

client = Todo2CodeClient("http://localhost:8787")
print(client.health())
result = client.diff_graph_files(".intent/run-a/intent.graph.json", ".intent/run-b/intent.graph.json")
print(result["diff"]["summary"])

files = client.diff_text_files("before.ts", "after.ts", include_html=True)
git = client.diff_git(revision="HEAD", include_svg=False)
with open(".intent/run-b/intent.graph.json", encoding="utf-8") as graph_file:
    after_graph = json.load(graph_file)
reality = client.reality(after_graph, gaps_only=True)
```

SDK korzysta wyłącznie z biblioteki standardowej Python i opcjonalnego Bearer tokenu. Metody grafowego diffu używają REST, natomiast diff plików/Git, reality i ogólne `run` korzystają z A2A v1.0.
