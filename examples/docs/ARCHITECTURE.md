# Architektura przykładowa

## Granica LLM

Ekstraktory NL, Git, AST, TODO i CHANGELOG muszą działać bez sieci. Dokumentacja może być analizowana przez OpenRouter, ale wynik ma klasę `llm_inference` i confidence nie większe niż 0,85.

## Runtime

Runtime powinien walidować kontrakt przed wykonaniem. Moduł raportowania nie powinien otrzymywać surowych plików źródłowych; otrzymuje graf i diagnostykę.
