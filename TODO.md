# TODO

- [ ] Add language adapters for Java and Rust ASTs.
- [ ] Persist a failed-run manifest when `require-llm` aborts before a graph can be built.
- [ ] Capture OpenRouter response ID, resolved provider/model and token usage when the provider returns them.
- [ ] Improve target normalization and bounded documentation-LLM extraction so Intent vs Reality can measure full plan + code + documentation coverage without broad, timeout-prone document runs.
- [ ] Replace or isolate the optional `@tensorflow/tfjs-node` installer chain until `npm audit` is clean; version 4.22.0 currently brings 7 high and 1 critical transitive advisories while the core `--omit=optional` install has zero.
