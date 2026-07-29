# todo2code Rust SDK

Klient A2A v1.0. Jedyne zależności to `serde`/`serde_json` — biblioteka
standardowa Rusta nie ma parsera JSON. HTTP/1.1 jest mówione wprost po
`std::net::TcpStream`, żeby nie wciągać runtime'u asynchronicznego.

Transport jest **wyłącznie po HTTP**. Serwer A2A nie robi TLS; przy wystawieniu
poza localhost należy postawić przed nim reverse proxy.

```rust
let client = Client::new("http://localhost:8787", None);

let ast = client.extract_ast("examples/backend")?;
let graph = client.link(&serde_json::to_value(&ast.records)?)?;
let report = client.diagnose(&graph)?;

let reality = client.reality(&graph, Some(&serde_json::to_value(&report)?), &json!({ "gapsOnly": true }))?;
```

```bash
cd sdk/rust && cargo test && cargo run --example basic
```

Pełny opis akcji: [`../README.md`](../README.md).
