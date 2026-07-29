# todo2code Go SDK

Klient A2A v1.0 na samej bibliotece standardowej.

```go
client := todo2code.New("http://localhost:8787", os.Getenv("T2C_A2A_TOKEN"))

ast, err := client.ExtractAST(ctx, "examples/backend")
graph, err := client.Link(ctx, ast.Records)
report, err := client.Diagnose(ctx, graph)

reality, err := client.Reality(ctx, graph, report, map[string]any{"gapsOnly": true})
fmt.Println(reality.Markdown)
```

```bash
cd sdk/go && go run ./examples/basic
```

Pełny opis akcji: [`../README.md`](../README.md).
