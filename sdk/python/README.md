# todo2code Python SDK

Paczka udostępnia dwa tryby:

- `T2CClient` / `Todo2CodeClient` — klient uruchomionego serwera A2A/REST;
- `TypeScriptRuntime` — lokalny most Python → Node.js, wykonujący kanoniczny
  runtime TypeScript bez uruchamiania serwera.

Instalacja lokalna:

```bash
python3 -m pip install .
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

## Lokalny runtime TypeScript

Najpierw zbuduj TypeScript i paczkę Python:

```bash
npm run build
make python-wheel
python3 -m pip install .intent-packages/python/todo2code-*.whl
```

Kanoniczny manifest Python znajduje się w katalogu głównym repozytorium.
Dystrybucję wheel i sdist do publikacji zbudujesz poleceniem:

```bash
python3 -m build
python3 -m twine check dist/todo2code-*
```

`python3 -m build` dopisuje archiwa Python do współdzielonego `dist/` i nie
usuwa istniejącego wyniku kompilacji TypeScript. Paczka zawiera wyłącznie
`todo2code`, moduł zgodności `todo2code_sdk` i metadane dystrybucji.

Następnie Python może uruchomić ten sam pipeline i `Intent vs Reality` bez
transportu HTTP:

```python
from todo2code import TypeScriptRuntime

runtime = TypeScriptRuntime("/path/to/repository")
run = runtime.pipeline(documentation_llm=False, output_dir=".intent-python")
reality = runtime.reality(
    run["graphPath"],
    diagnostics_path=run["diagnosticsPath"],
    gaps_only=True,
)
print(reality["view"]["totals"])
```

`TypeScriptRuntime.pipeline()` domyślnie ustawia deterministyczne NL i Markdown
oraz `summary_llm=False`, więc nawet obecność klucza w `.env` nie uruchamia
OpenRouter. Wywołania LLM wymagają jawnego ustawienia odpowiednich parametrów.

Wymagany jest Node.js oraz dostępny skompilowany `dist/src/cli.js` albo
wykonywalny `t2c`. Dla instalacji poza repo ustaw `T2C_TYPESCRIPT_CLI` na
bezwzględną ścieżkę CLI. Paczka Python nie replikuje logiki DSL — proces Node.js
pozostaje jedynym źródłem semantyki.
