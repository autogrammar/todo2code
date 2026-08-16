<!-- code2docs:start --># todo2code

![version](https://img.shields.io/badge/version-0.5.0-blue) ![node](https://img.shields.io/badge/node-%3E%3D20-339933) ![coverage](https://img.shields.io/badge/coverage-unknown-lightgrey) ![functions](https://img.shields.io/badge/functions-3288-green)
> **3288** functions | **348** classes | **389** files | CC̄ = 4.0

> Auto-generated project documentation from source code analysis.

**Author:** Tom Softreck <tom@sapletta.com>
**License:** [Apache-2.0](../LICENSE)
**Repository:** [https://github.com/semcod/todo2code](https://github.com/semcod/todo2code)

## Installation

### Requirements

- Node.js >=20
### From Source

```bash
git clone https://github.com/semcod/todo2code
cd todo2code
npm install
```

## Quick Start

```bash
npm install
npm start
```




## Architecture

```
todo2code/
├── tsconfig
├── project
    ├── e2e
├── package
├── docker-compose
├── TODO
├── TASK
├── Dockerfile
├── CONTRIBUTION
├── CHANGELOG
├── Makefile
├── README
├── src/
    ├── version
        ├── classifier
        ├── task-synthesis-contract
        ├── validation
        ├── payload
        ├── task-synthesis-payload
        ├── reranker-response
        ├── diff-ui
        ├── typescript
        ├── code-change-path
        ├── types
        ├── render
        ├── compile-cli
        ├── contract
        ├── summarizer
        ├── reranker-llm
        ├── subactor
        ├── failure
        ├── audit
        ├── watcher
        ├── artifact
        ├── todo-patch
        ├── mcp-errors
        ├── tasks-llm
        ├── structured-schema
        ├── mcp-tools
        ├── mcp-resources
        ├── model-comparison
        ├── mcp
        ├── task-synthesis-materialize
        ├── a2a-card
        ├── symbol-resolution
        ├── reranker
        ├── a2a
        ├── a2a-types
        ├── a2a-message
        ├── capability-evidence
        ├── validation
        ├── changelog-signal
        ├── nl
        ├── openrouter
        ├── diff
        ├── markdown-block
        ├── run
        ├── docs-types
        ├── a2a-task-store
        ├── markdown
        ├── todo
        ├── a2a-history
        ├── docs-schema
        ├── nl-llm
    ├── cli
        ├── contract-check
        ├── markdown-paths
        ├── git
            ├── unsupported
        ├── docs-record
            ├── rust
            ├── types
            ├── python
        ├── diagnostics
            ├── php
            ├── java
        ├── docs-chunks
            ├── go
            ├── typescript
        ├── markdown-llm
        ├── ast
        ├── gold-metrics
        ├── docs-llm
        ├── text-types
        ├── gold-cli
            ├── external
        ├── gold-extraction
        ├── svg
        ├── changelog
        ├── docs-deterministic
            ├── records
        ├── gold
        ├── gold-types
        ├── version
        ├── target
        ├── actions
        ├── git
        ├── types
        ├── record
        ├── security
        ├── grounding
        ├── content-cache
        ├── ignore
        ├── communication
        ├── io
        ├── id
        ├── text
        ├── gold-cases
    ├── README
        ├── package
        ├── tsconfig
        ├── README
        ├── code-change-plan
        ├── identity
        ├── README
        ├── Cargo
        ├── src
            ├── types
        ├── text-render
            ├── error
        ├── configuration
            ├── actions
            ├── client
        ├── env
        ├── pyproject
        ├── README
            ├── basic
        ├── linker
        ├── llm
        ├── composer
            ├── basic
        ├── reality
        ├── README
        ├── text
        ├── src/
            ├── basic
            ├── Error
        ├── todo2code
        ├── README
            ├── Client
                ├── main
        ├── client
        ├── workspace
    ├── verify-structured-responses
    ├── verify-workflow-yaml
        ├── types
    ├── verify-no-llm-imports
        ├── analyzer
    ├── verify-generated-analysis
    ├── sync-generated-readme-metadata
    ├── smoke
    ├── mcp-request
    ├── normalize-generated-analysis-roots
        ├── actions
    ├── verify-env-contract
    ├── examples-check
    ├── e2e
    ├── docker-smoke
    ├── generate-response-schemas
    ├── live-model-comparison
    ├── a2a-request
    ├── assert-demollm-run
    ├── verify-module-boundaries
    ├── live-contract-check
        ├── README
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── audit-changelog-sample
        ├── schema
        ├── rerank-embedding-shortlist
        ├── schema
        ├── schema
    ├── Cargo
        ├── schema
    ├── requirements
        ├── schema
        ├── system
        ├── system
        ├── system
        ├── schema
        ├── main
        ├── system
        ├── system
        ├── preprompt
        ├── changelog
        ├── ai-codex
        ├── README
        ├── preprompt
        ├── changelog
        ├── ai-codex-logs
        ├── audit
        ├── system
        ├── ai-codex-logs
        ├── README
        ├── ai-codex
        ├── preprompt
        ├── changelog
        ├── audit
        ├── ai-codex-logs
        ├── README
        ├── changelog
        ├── preprompt
        ├── ai-codex
        ├── ai-codex-logs
        ├── audit
        ├── preprompt
        ├── README
        ├── changelog
        ├── audit
        ├── ai-codex
        ├── ai-codex-logs
        ├── ai-codex
        ├── preprompt
        ├── audit
        ├── changelog
        ├── ai-codex-logs
        ├── README
        ├── ai-codex
        ├── changelog
        ├── audit
        ├── ai-codex
        ├── README
        ├── README
        ├── preprompt
        ├── changelog
        ├── audit
        ├── preprompt
        ├── ai-codex-logs
        ├── ai-codex-logs
        ├── README
        ├── preprompt
        ├── changelog
        ├── audit
        ├── ai-codex-logs
        ├── ai-codex
        ├── preprompt
        ├── README
        ├── changelog
        ├── audit
        ├── ai-codex
        ├── ai-codex-logs
        ├── ai-codex
        ├── preprompt
        ├── changelog
        ├── ai-codex
        ├── ai-codex-logs
        ├── audit
        ├── preprompt
        ├── changelog
        ├── README
        ├── audit
        ├── ai-codex
        ├── README
        ├── user-tom-sapletta-com
        ├── README
        ├── ai-codex-logs
        ├── changelog
        ├── audit
        ├── ai-codex
        ├── ai-codex-logs
        ├── README
        ├── user-tom-sapletta-com
        ├── preprompt
        ├── platform-e5-reciprocal-ranking
        ├── preprompt
        ├── platform-e5-ranking
        ├── minilm-results
        ├── iteration-01
        ├── e5-results
        ├── e5-prefixed-results
        ├── benchmark
        ├── audit
        ├── ai-codex
        ├── changelog
        ├── user-tom-sapletta-com
        ├── README
        ├── preprompt
        ├── ai-codex-logs
        ├── iteration-01
        ├── changelog
        ├── ai-codex
        ├── ai-codex-logs
        ├── audit
        ├── sample
        ├── README
        ├── iteration-02
        ├── preprompt
        ├── user-tom-sapletta-com
        ├── iteration-01
        ├── baseline
        ├── changelog
        ├── ai-codex
        ├── ai-codex-logs
        ├── README
        ├── logs
        ├── README
        ├── AI-Codex
    ├── ast_extract
    ├── task
    ├── JavaAstExtract
    ├── TODO
    ├── CHANGELOG
        ├── runtime
        ├── typescript
    ├── ast_extract
        ├── participants
                        ├── 001
                        ├── 001
                        ├── 001
                        ├── 002
                        ├── 001
        ├── tsconfig
        ├── task
        ├── TODO
        ├── README
        ├── CHANGELOG
├── sdk/
            ├── render
            ├── app
            ├── api
        ├── tsconfig
        ├── task
        ├── ARCHITECTURE
        ├── TODO
        ├── README
        ├── CHANGELOG
            ├── validation
            ├── store
        ├── README
            ├── server
            ├── dataset
            ├── dataset
    ├── VALIDATION
    ├── TEST_REPORT
    ├── TEAM_COMMUNICATION
    ├── SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW
    ├── SUBACTOR_OPERATION_DSL
    ├── REQUIREMENTS
    ├── READINESS
    ├── PROTOCOLS
    ├── SECURITY
    ├── PROJECT_STATUS
    ├── PIPELINE_DSL_NL
    ├── OPTIMIZATION
    ├── E2E
    ├── GROK-PLAN
    ├── DSL
    ├── DEMOLLM
    ├── CODE_CHANGE_PLANS
    ├── CLI_GUIDE
        ├── original-monitoring-design
        ├── README
        ├── ALL_DIAGRAMS
    ├── ARCHITECTURE
        ├── package
        ├── todo2code/
        ├── todo2code_sdk
        ├── evaluate-embedding-pairs
    ├── python/
    ├── vallm-compatible
        ├── rank-intent-graph-embeddings
        ├── helper
            ├── runtime
    ├── package
            ├── local_runtime
            ├── basic
        ├── python
    ├── ast_extract
            ├── client
```

## API Overview

### Classes

- **`TfTensor`** — —
- **`TfModel`** — —
- **`TfModule`** — —
- **`ModelAssets`** — —
- **`RawConclusion`** — —
- **`RawProposal`** — —
- **`RawTaskSynthesisResponse`** — —
- **`TodoProposalDuplicate`** — —
- **`TodoProposalValidationResult`** — —
- **`SemanticRerankerResponse`** — —
- **`Todo2CodeClientOptions`** — —
- **`DiffResult`** — —
- **`FileDiffResult`** — —
- **`GitDiffResponse`** — —
- **`RealityResult`** — —
- **`Todo2CodeClient`** — —
- **`VariableContract`** — —
- **`OperationParameterReference`** — —
- **`OperationRollback`** — —
- **`OperationStep`** — —
- **`OperationExpectation`** — —
- **`OperationPlan`** — —
- **`ResolvedVariableBinding`** — —
- **`SubactorProcessEnvelope`** — —
- **`SummaryResult`** — —
- **`SummaryOptions`** — —
- **`RawConclusion`** — —
- **`RawSummaryResponse`** — —
- **`SummaryAttemptError`** — —
- **`SemanticRerankerOptions`** — —
- **`SemanticRerankerRequiredError`** — —
- **`CompileSubactorEnvelopeOptions`** — —
- **`LlmFailureReason`** — —
- **`SnapshotDelta`** — —
- **`ScanOptions`** — —
- **`ReportResult`** — —
- **`WatchOptions`** — —
- **`CompileOperationPlanArtifactOptions`** — —
- **`OperationPlanCompilationReceipt`** — —
- **`CreateTodoPatchOptions`** — —
- **`CreatedTodoPatch`** — —
- **`WriteTodoPatchOptions`** — —
- **`WrittenTodoPatch`** — —
- **`ApplyTodoPatchOptions`** — —
- **`McpRequestError`** — —
- **`RawDiagnosticAction`** — —
- **`AuditedTaskSynthesisResult`** — —
- **`TaskSynthesisRequiredError`** — —
- **`TaskSynthesisAttemptError`** — —
- **`StructuredSchema`** — —
- **`StructuredResponseError`** — —
- **`StringOptions`** — —
- **`NumberOptions`** — —
- **`ArrayOptions`** — —
- **`McpTool`** — —
- **`LiveModelRun`** — —
- **`LiveModelMeasurement`** — —
- **`LiveModelAgreement`** — —
- **`LiveModelComparison`** — —
- **`JsonRpcRequest`** — —
- **`McpConnectionState`** — —
- **`AstSymbolCandidate`** — —
- **`NlSymbolResolution`** — —
- **`SymbolResolutionIndex`** — —
- **`SemanticRetrievalIdentity`** — —
- **`SemanticCandidate`** — —
- **`SemanticCandidateSet`** — —
- **`SemanticCandidateInput`** — —
- **`SemanticRetrievalInput`** — —
- **`SemanticEvidenceCitation`** — —
- **`SemanticRerankDecisionInput`** — —
- **`SemanticRerankDecision`** — —
- **`SemanticRerankGeneration`** — —
- **`SemanticRerankResult`** — —
- **`SemanticRerankGenerationInput`** — —
- **`JsonRpcRequest`** — —
- **`A2APart`** — —
- **`A2AMessage`** — —
- **`A2AArtifact`** — —
- **`A2ATask`** — —
- **`StoredTask`** — —
- **`SendConfiguration`** — —
- **`A2ARequestError`** — —
- **`BodyTooLargeError`** — —
- **`NlExtractionOptions`** — —
- **`ChatMessage`** — —
- **`OpenRouterChoice`** — —
- **`OpenRouterResponse`** — —
- **`OpenRouterResult`** — —
- **`OpenRouterModelsResponse`** — —
- **`OpenRouterModelError`** — —
- **`OpenRouterClient`** — —
- **`DiffSvgOptions`** — —
- **`MarkdownListBlock`** — —
- **`PipelineResult`** — —
- **`RawDocumentRecord`** — —
- **`DocumentResponse`** — —
- **`DocumentChunk`** — —
- **`DocumentationTargetHints`** — —
- **`DocumentationExtractionOptions`** — —
- **`DocumentationExtractionResult`** — —
- **`DocumentChunkResult`** — —
- **`PreparedTask`** — —
- **`ListCursor`** — —
- **`TaskStoreSnapshot`** — —
- **`MarkdownExtractionOptions`** — —
- **`IntentRunListItem`** — —
- **`CommunicationRunSummary`** — —
- **`RunHistoryFilters`** — —
- **`RawNlRecord`** — —
- **`NlResponse`** — —
- **`AuditedNlExtractionResult`** — —
- **`NlLlmRequiredError`** — —
- **`NlAttemptError`** — —
- **`ParsedArgs`** — —
- **`LiveBudget`** — —
- **`LiveStageMeasurement`** — —
- **`LiveHistoryRecord`** — —
- **`LiveHistoryStageSummary`** — —
- **`LiveHistorySummary`** — —
- **`LiveContractAudit`** — —
- **`MarkdownPathResolver`** — —
- **`GitCommit`** — —
- **`ChangedFile`** — —
- **`GitExtractionOptions`** — —
- **`AdapterFact`** — —
- **`AdapterOutput`** — —
- **`MarkdownEnrichment`** — —
- **`MarkdownResponse`** — —
- **`AuditedMarkdownExtractionResult`** — —
- **`MarkdownLlmRequiredError`** — —
- **`MarkdownAttemptError`** — —
- **`CoveredBatch`** — —
- **`AstExtractionOptions`** — —
- **`ExternalCacheAdapter`** — —
- **`Counts`** — —
- **`DocumentationLlmRequiredError`** — —
- **`DiffLine`** — —
- **`DiffHunk`** — —
- **`FileDiff`** — —
- **`DiffTextOptions`** — —
- **`ExternalAdapterOptions`** — —
- **`SvgTheme`** — —
- **`SvgDocumentOptions`** — —
- **`DeterministicDocumentationOptions`** — —
- **`EvaluationCore`** — —
- **`EvaluationRun`** — —
- **`EvaluationResult`** — —
- **`GoldRecordProjection`** — —
- **`GoldDocumentModelRecord`** — —
- **`GoldExtractionCase`** — —
- **`GoldFixtureRecord`** — —
- **`GoldExpectedRelation`** — —
- **`GoldRerankerDecisionFixture`** — —
- **`GoldRerankerFixture`** — —
- **`GoldLinkingCase`** — —
- **`GoldProposalFixture`** — —
- **`GoldDsl2TodoCase`** — —
- **`GoldExpectedDiagnostic`** — —
- **`GoldDiagnosticsCase`** — —
- **`GoldDataset`** — —
- **`BinaryMetric`** — —
- **`GoldEvaluationReport`** — —
- **`GitDiffOptions`** — —
- **`GitDiffResult`** — —
- **`ChangedEntry`** — —
- **`SourceLineRange`** — —
- **`IntentTarget`** — —
- **`IntentStatement`** — —
- **`IntentSource`** — —
- **`IntentEpistemic`** — —
- **`IntentLifecycle`** — —
- **`IntentGenerationMetadata`** — —
- **`IntentRecordMetadata`** — —
- **`IntentRecord`** — —
- **`IntentRelation`** — —
- **`IntentGraph`** — —
- **`IntentRecordChange`** — —
- **`IntentGraphDiff`** — —
- **`Diagnostic`** — —
- **`DiagnosticReport`** — —
- **`GroundedGenerationMetadata`** — —
- **`Conclusion`** — —
- **`TodoProposal`** — —
- **`CodeChangeFile`** — —
- **`CodeChangeRisk`** — —
- **`CodeChangePlan`** — —
- **`CodeChangeAcceptance`** — —
- **`CodeChangeCloseResult`** — —
- **`CodeChangeReviewPatch`** — —
- **`CodeChangeSourceEdit`** — —
- **`CodeChangeSourcePatch`** — —
- **`CodeChangeSourcePatchSet`** — —
- **`CodeChangeSourcePatchApproval`** — —
- **`CodeChangeSourceApplyReceipt`** — —
- **`TodoPatchDuplicateClassification`** — —
- **`TodoPatchArtifact`** — —
- **`TodoPatchApproval`** — —
- **`TodoApplyReceipt`** — —
- **`TodoApplyResult`** — —
- **`ExtractionResult`** — —
- **`ContentCacheStats`** — —
- **`CachedExtractionResult`** — —
- **`LlmResponseMetadata`** — —
- **`PipelineStageAudit`** — —
- **`PipelineOptions`** — —
- **`PipelineManifest`** — —
- **`BuildRecordGenerationInput`** — —
- **`BuildRecordInput`** — —
- **`CacheEnvelope`** — —
- **`ContentCacheOptions`** — —
- **`ContentCacheEntryOptions`** — —
- **`ContentCache`** — —
- **`IgnoreRule`** — —
- **`IgnoreMatcher`** — —
- **`LoadIgnoreOptions`** — —
- **`CommunicationExtractionOptions`** — —
- **`CommunicationEnvelope`** — —
- **`InferredCommunicationIdentity`** — —
- **`CommunicationSegment`** — —
- **`WalkOptions`** — —
- **`RawOp`** — —
- **`LinkingCaseResult`** — —
- **`RerankingCaseResult`** — —
- **`DiagnosticsCaseResult`** — —
- **`Dsl2TodoCaseResult`** — —
- **`ProposeCodeChangePlansOptions`** — —
- **`ProposeCodeChangePlansResult`** — —
- **`EvaluateCodeChangeAcceptanceOptions`** — —
- **`CloseCodeChangesOptions`** — —
- **`CreateCodeChangeReviewOptions`** — —
- **`CreatedCodeChangeReview`** — —
- **`CreateCodeChangeSourcePatchOptions`** — —
- **`ApplyCodeChangeSourcePatchOptions`** — —
- **`ApplyCodeChangeSourcePatchResult`** — —
- **`PreparedSourceEdit`** — —
- **`ParticipantIdentityEntry`** — —
- **`ParticipantIdentityRegistry`** — —
- **`LoadedParticipantIdentityRegistry`** — —
- **`SourceLineRange`** — —
- **`IntentTarget`** — —
- **`IntentStatement`** — —
- **`IntentSource`** — —
- **`IntentEpistemic`** — —
- **`IntentLifecycle`** — —
- **`IntentGenerationMetadata`** — —
- **`IntentRecord`** — —
- **`Diagnostic`** — —
- **`DiagnosticReport`** — —
- **`ExtractionResult`** — —
- **`TextDiffSvgOptions`** — —
- **`SideBySideRow`** — —
- **`ConfigurationEntry`** — —
- **`Client`** — —
- **`T2CConfig`** — —
- **`PairEvidence`** — —
- **`RecordKeywords`** — —
- **`DirectedRelation`** — —
- **`SourceRelationRule`** — —
- **`RawCommunicationEnrichment`** — —
- **`RawParticipantSynthesis`** — —
- **`RawCommunicationResponse`** — —
- **`ParticipantCommunicationSynthesis`** — —
- **`AuditedCommunicationExtractionResult`** — —
- **`CommunicationLlmRequiredError`** — —
- **`CommunicationAttemptError`** — —
- **`ParticipantGroup`** — —
- **`RealityRow`** — —
- **`IntentRealityView`** — —
- **`RealitySvgOptions`** — —
- **`IntentTarget`** — —
- **`IntentStatement`** — —
- **`IntentGenerationMetadata`** — —
- **`IntentRecord`** — —
- **`IntentGraph`** — —
- **`DiagnosticReport`** — —
- **`ExtractionAudit`** — —
- **`ExtractionResult`** — —
- **`A2APart`** — —
- **`A2AMessage`** — —
- **`A2ATask`** — —
- **`T2CError`** — —
- **`ClientOptions`** — —
- **`T2CClient`** — —
- **`Error`** — —
- **`Client`** — —
- **`Client`** — —
- **`rpcRequest`** — —
- **`rpcResponse`** — —
- **`WorkspaceComparisonOptions`** — —
- **`CoverageSnapshot`** — —
- **`WorkspaceComparison`** — —
- **`SourceLineRange`** — —
- **`IntentTarget`** — —
- **`IntentStatement`** — —
- **`IntentSource`** — —
- **`IntentEpistemic`** — —
- **`IntentGenerationMetadata`** — —
- **`IntentRecord`** — —
- **`IntentRelation`** — —
- **`IntentGraph`** — —
- **`Diagnostic`** — —
- **`DiagnosticReport`** — —
- **`ExtractionResult`** — —
- **`Part`** — —
- **`Message`** — —
- **`Artifact`** — —
- **`Task`** — —
- **`RealityResult`** — —
- **`DiffResult`** — —
- **`Error`** — —
- **`CommunicationIssue`** — —
- **`ParticipantCommunicationAnalysis`** — —
- **`CommunicationAnalysis`** — —
- **`GroundedValidationContext`** — —
- **`TodoProposalValidationContext`** — —
- **`CodeChangePlanValidationContext`** — —
- **`CodeChangeAcceptanceValidationContext`** — —
- **`Fact`** — —
- **`Output`** — —
- **`Collector`** — —
- **`JavaAstExtract`** — —
- **`Contract`** — —
- **`Fact`** — —
- **`output`** — —
- **`factCollector`** — —
- **`PanelRow`** — —
- **`PanelState`** — —
- **`IntentEvent`** — —
- **`EventPage`** — —
- **`ApiError`** — —
- **`ValidationResult`** — —
- **`IntentEvent`** — —
- **`EventPage`** — —
- **`EventStore`** — —
- **`BackendOptions`** — —
- **`Todo2CodeClient`** — Diff-focused client for the todo2code runtime.
- **`TypeScriptRuntimeError`** — Raised when the local Node/TypeScript runtime cannot be executed.
- **`RuntimeResult`** — Raw result of a local TypeScript CLI invocation.
- **`TypeScriptRuntime`** — Execute the canonical TypeScript runtime from a Python process.
- **`FactVisitor`** — —
- **`T2CError`** — Raised for JSON-RPC errors, transport failures and non-completed tasks.
- **`IntentRecord`** — A single t2c.intent/v1 record.
- **`ExtractionResult`** — Records, warnings and the optional audited LLM stage result.
- **`Diagnostic`** — —
- **`DiagnosticReport`** — —
- **`IntentGraph`** — —
- **`T2CClient`** — Client for the todo2code A2A endpoint.

### Functions

- `install_project_package()` — —
- `cleanup_analysis_snapshot()` — —
- `run_analysis_tool()` — —
- `dynamicImport()` — —
- `importer()` — —
- `loadAssets()` — —
- `directory()` — —
- `vocabularyPath()` — —
- `labels()` — —
- `loadClassifier()` — —
- `modelPath()` — —
- `modulePath()` — —
- `moduleValue()` — —
- `absolute()` — —
- `model()` — —
- `assets()` — —
- `vectorize()` — —
- `values()` — —
- `index()` — —
- `classifyAction()` — —
- `fallback()` — —
- `loaded()` — —
- `vector()` — —
- `input()` — —
- `predictionValue()` — —
- `prediction()` — —
- `probabilities()` — —
- `bestIndex()` — —
- `action()` — —
- `confidence()` — —
- `taskStrings()` — —
- `taskIds()` — —
- `nonBlank()` — —
- `RAW_CONCLUSION_CONTRACT()` — —
- `RAW_PROPOSAL_CONTRACT()` — —
- `TASK_SYNTHESIS_RESPONSE_CONTRACT()` — —
- `validateAndClassifyTodoProposals()` — —
- `existing()` — —
- `duplicates()` — —
- `orderedProposalIds()` — —
- `duplicateProposalIds()` — —
- `duplicateIds()` — —
- `duplicateEvidence()` — —
- `proposalWords()` — —
- `target()` — —
- `sharedTicket()` — —
- `sharedSymbol()` — —
- `sharedPath()` — —
- `similarity()` — —
- `dependencyFirstPriorityOrder()` — —
- `byId()` — —
- `remainingDependencies()` — —
- `dependents()` — —
- `values()` — —
- `compare()` — —
- `left()` — —
- `right()` — —
- `ready()` — —
- `id()` — —
- `remaining()` — —
- `words()` — —
- `jaccard()` — —
- `common()` — —
- `intersects()` — —
- `compactSummaryPayload()` — —
- `referenced()` — —
- `nonAst()` — —
- `moduleAst()` — —
- `relevantAst()` — —
- `ids()` — —
- `selectedRelations()` — —
- `compactRecord()` — —
- `compactSynthesisPayload()` — —
- `recordIds()` — —
- `todoRecords()` — —
- `records()` — —
- `includedIds()` — —
- `groundedDiagnostics()` — —
- `compactRecord()` — —
- `compareDiagnostics()` — —
- `RERANK_DECISION_CONTRACT()` — —
- `SEMANTIC_RERANK_RESPONSE_CONTRACT()` — —
- `SEMANTIC_RERANK_RESPONSE_SCHEMA()` — —
- `assertSemanticRerankerResponse()` — —
- `response()` — —
- `diffUiHtml()` — —
- `byId()` — —
- `requestHeaders()` — —
- `formatBytes()` — —
- `selectedRun()` — —
- `updateMeta()` — —
- `fillSelect()` — —
- `loadRuns()` — —
- `compareGraphs()` — —
- `NON_SOURCE_DIR_SEGMENTS()` — —
- `BINARY_EXTENSIONS()` — —
- `GENERATED_ANALYSIS_BASENAMES()` — —
- `T2C_ARTIFACT_BASENAMES()` — —
- `EXTENSIONLESS_SOURCE_BASENAMES()` — —
- `isPlannablePath()` — —
- `normalized()` — —
- `segments()` — —
- `lowerSegments()` — —
- `basename()` — —
- `lowerBasename()` — —
- `dot()` — —
- `ext()` — —
- `isUsefulCodeChangePath()` — —
- `renderSummaryMarkdown()` — —
- `plans()` — —
- `git()` — —
- `moduleFacts()` — —
- `facts()` — —
- `releases()` — —
- `communication()` — —
- `actions()` — —
- `compareConclusions()` — —
- `renderRecords()` — —
- `confidence()` — —
- `renderConclusion()` — —
- `recordCitations()` — —
- `argumentsByName()` — —
- `key()` — —
- `value()` — —
- `allowed()` — —
- `unknown()` — —
- `main()` — —
- `args()` — —
- `variableContractSemanticValue()` — —
- `createVariableContract()` — —
- `normalized()` — —
- `normalizedPlanDraft()` — —
- `operationPlanHashMaterial()` — —
- `createOperationPlan()` — —
- `planHash()` — —
- `summarizeGraph()` — —
- `mode()` — —
- `conclusions()` — —
- `client()` — —
- `systemPrompt()` — —
- `payload()` — —
- `failure()` — —
- `responses()` — —
- `SUMMARY_CONCLUSION_CONTRACT()` — —
- `SUMMARY_RESPONSE_CONTRACT()` — —
- `valueMatchesType()` — —
- `assertBinding()` — —
- `ageSeconds()` — —
- `compileSubactorProcessEnvelope()` — —
- `variableById()` — —
- `referenced()` — —
- `variable()` — —
- `binding()` — —
- `humanApproval()` — —
- `classifyLlmFailure()` — —
- `message()` — —
- `rejectedLlmResponseMetadata()` — —
- `openRouterAuditConfiguration()` — —
- `scanTree()` — —
- `maxFiles()` — —
- `absoluteRoot()` — —
- `visit()` — —
- `absolute()` — —
- `relative()` — —
- `stat()` — —
- `diffSnapshots()` — —
- `previous()` — —
- `describeDelta()` — —
- `shown()` — —
- `rest()` — —
- `DEFAULT_MIN_INTERVAL_MS()` — —
- `DEFAULT_SCAN_INTERVAL_MS()` — —
- `watchRepository()` — —
- `root()` — —
- `minIntervalMs()` — —
- `scanIntervalMs()` — —
- `emit()` — —
- `now()` — —
- `sleep()` — —
- `signal()` — —
- `matcher()` — —
- `runReport()` — —
- `result()` — —
- `snapshot()` — —
- `lastReportStartedAt()` — —
- `pending()` — —
- `current()` — —
- `delta()` — —
- `waitMs()` — —
- `generate()` — —
- `startedAt()` — —
- `defaultSleep()` — —
- `timer()` — —
- `onAbort()` — —
- `finish()` — —
- `readJson()` — —
- `writeExclusive()` — —
- `target()` — —
- `directory()` — —
- `temporary()` — —
- `existing()` — —
- `compileOperationPlanArtifact()` — —
- `plan()` — —
- `bindings()` — —
- `envelope()` — —
- `diagnosticReportFingerprint()` — —
- `createTodoPatch()` — —
- `expectedValidation()` — —
- `proposalById()` — —
- `selected()` — —
- `proposal()` — —
- `orderedSelected()` — —
- `markdown()` — —
- `renderTodoPatchMarkdown()` — —
- `writeTodoPatchArtifacts()` — —
- `created()` — —
- `patchPath()` — —
- `auditPath()` — —
- `applyTodoPatch()` — —
- `current()` — —
- `receipt()` — —
- `now()` — —
- `currentHash()` — —
- `result()` — —
- `applied()` — —
- `recovered()` — —
- `assertTodoPatchArtifact()` — —
- `artifact()` — —
- `sourceTodo()` — —
- `duplicates()` — —
- `classified()` — —
- `duplicate()` — —
- `assertApproval()` — —
- `assertReceipt()` — —
- `atomicWrite()` — —
- `temporary()` — —
- `existing()` — —
- `handle()` — —
- `appendPatch()` — —
- `separator()` — —
- `wasAlreadyAppended()` — —
- `renderTargets()` — —
- `rendered()` — —
- `renderIds()` — —
- `inline()` — —
- `normalizePath()` — —
- `sameArray()` — —
- `object()` — —
- `exactKeys()` — —
- `expected()` — —
- `missing()` — —
- `extra()` — —
- `nonBlank()` — —
- `hash()` — —
- `isoDate()` — —
- `uniqueIds()` — —
- `uniqueStrings()` — —
- `callMcpTool()` — —
- `name()` — —
- `args()` — —
- `result()` — —
- `tool()` — —
- `writes()` — —
- `stringProp()` — —
- `nullableStringProp()` — —
- `stringArrayProp()` — —
- `numberProp()` — —
- `listMcpResources()` — —
- `readRequestedMcpResource()` — —
- `uri()` — —
- `readMcpResource()` — —
- `latestPath()` — —
- `selected()` — —
- `latest()` — —
- `filePath()` — —
- `latestPointer()` — —
- `assertInsideRoot()` — —
- `relative()` — —
- `isInvalidResourceError()` — —
- `resource()` — —
- `measureLiveModelRun()` — —
- `responses()` — —
- `records()` — —
- `enrichedRecords()` — —
- `costUsd()` — —
- `isLlmEnriched()` — —
- `sourceKey()` — —
- `lines()` — —
- `compareLiveModelOutputs()` — —
- `rightBySource()` — —
- `pairs()` — —
- `agreeing()` — —
- `buildLiveModelComparison()` — —
- `models()` — —
- `passing()` — —
- `pick()` — —
- `measured()` — —
- `renderLiveModelComparison()` — —
- `sumUsage()` — —
- `values()` — —
- `round()` — —
- `DISCOVERY_TTL_MS()` — —
- `LIST_TTL_MS()` — —
- `RESOURCE_TTL_MS()` — —
- `createMcpConnectionState()` — —
- `startMcpServer()` — —
- `resolvedConfig()` — —
- `state()` — —
- `input()` — —
- `parsed()` — —
- `request()` — —
- `result()` — —
- `handleMcpRequest()` — —
- `initializeLegacy()` — —
- `params()` — —
- `requested()` — —
- `protocolVersion()` — —
- `handleModernRequest()` — —
- `responseMeta()` — —
- `handleLegacyRequest()` — —
- `validateModernRequest()` — —
- `meta()` — —
- `validateModernMetadata()` — —
- `capabilities()` — —
- `hasModernMetadata()` — —
- `parseRequestLine()` — —
- `completePublic()` — —
- `serverInfo()` — —
- `serverMeta()` — —
- `serverInstructions()` — —
- `isLegacyProtocol()` — —
- `isJsonRpcRequest()` — —
- `candidate()` — —
- `requestId()` — —
- `id()` — —
- `rpcError()` — —
- `sendError()` — —
- `send()` — —
- `invokedPath()` — —
- `materializeTaskSynthesisResponse()` — —
- `parsed()` — —
- `conclusionKeys()` — —
- `proposalKeys()` — —
- `conclusions()` — —
- `diagnosticIds()` — —
- `conclusionIdByKey()` — —
- `conclusionByKey()` — —
- `proposalDrafts()` — —
- `citedConclusions()` — —
- `conclusion()` — —
- `proposalIdByKey()` — —
- `proposals()` — —
- `normalizeLocalKeys()` — —
- `explicit()` — —
- `reserved()` — —
- `keys()` — —
- `hasBlankKey()` — —
- `key()` — —
- `suffix()` — —
- `mapKeys()` — —
- `id()` — —
- `sortedUnique()` — —
- `normalizeStringArray()` — —
- `values()` — —
- `normalizeRawTarget()` — —
- `target()` — —
- `normalizeAcceptanceCriteria()` — —
- `criteria()` — —
- `source()` — —
- `assertProposalEvidenceMatchesConclusions()` — —
- `byId()` — —
- `cited()` — —
- `diagnostics()` — —
- `records()` — —
- `sendAgentCard()` — —
- `card()` — —
- `serialized()` — —
- `payload()` — —
- `agentCard()` — —
- `skills()` — —
- `skill()` — —
- `buildSymbolResolutionIndex()` — —
- `byAlias()` — —
- `values()` — —
- `byNlRecord()` — —
- `hasResolvedNlAstSymbolPair()` — —
- `nl()` — —
- `ast()` — —
- `resolveSymbol()` — —
- `matched()` — —
- `selected()` — —
- `paths()` — —
- `pathSelects()` — —
- `normalized()` — —
- `candidatePath()` — —
- `uniquePaths()` — —
- `isAstDeclaration()` — —
- `createSemanticCandidateSet()` — —
- `grouped()` — —
- `values()` — —
- `assertSemanticCandidateSet()` — —
- `records()` — —
- `seenIds()` — —
- `seenPairs()` — —
- `byDeclaration()` — —
- `declaration()` — —
- `module()` — —
- `expectedHash()` — —
- `createSemanticRerankResult()` — —
- `decisions()` — —
- `assertSemanticRerankResult()` — —
- `candidates()` — —
- `seenDecisions()` — —
- `acceptedDeclarations()` — —
- `candidate()` — —
- `citations()` — —
- `record()` — —
- `applyAcceptedSemanticRelations()` — —
- `added()` — —
- `validateRetrieval()` — —
- `validateGeneration()` — —
- `validateVerdictReason()` — —
- `assertSemanticVerdictReason()` — —
- `allowed()` — —
- `reasons()` — —
- `assertGroundedQuote()` — —
- `quote()` — —
- `boundedScore()` — —
- `roundedConfidence()` — —
- `requiredText()` — —
- `validDate()` — —
- `comparePair()` — —
- `startA2aServer()` — —
- `resolvedConfig()` — —
- `server()` — —
- `address()` — —
- `port()` — —
- `handleHttp()` — —
- `url()` — —
- `handlePublicGet()` — —
- `handleAuthenticatedApi()` — —
- `handleDiffApi()` — —
- `input()` — —
- `handleJsonRpc()` — —
- `rpc()` — —
- `isNotification()` — —
- `result()` — —
- `parseRpcRequest()` — —
- `status()` — —
- `sendRpcFailure()` — —
- `code()` — —
- `metadata()` — —
- `requireAuthorization()` — —
- `requireProtocolVersion()` — —
- `requestedVersion()` — —
- `a2aVersion()` — —
- `raw()` — —
- `headerVersion()` — —
- `authorized()` — —
- `header()` — —
- `received()` — —
- `expected()` — —
- `principalForRequest()` — —
- `readBody()` — —
- `length()` — —
- `chunk()` — —
- `sendJson()` — —
- `payload()` — —
- `sendText()` — —
- `sendNoContent()` — —
- `rpcError()` — —
- `reason()` — —
- `errorInfo()` — —
- `stringMetadata()` — —
- `handleUnexpectedError()` — —
- `errorMessage()` — —
- `invokedPath()` — —
- `TERMINAL_TASK_STATES()` — —
- `TASK_STATES()` — —
- `parseSendConfiguration()` — —
- `validateOutputModes()` — —
- `supported()` — —
- `parseCommand()` — —
- `objectData()` — —
- `text()` — —
- `first()` — —
- `commandFromData()` — —
- `action()` — —
- `nested()` — —
- `parseKeyValues()` — —
- `key()` — —
- `raw()` — —
- `stringValue()` — —
- `parseScalar()` — —
- `parseMessage()` — —
- `messageId()` — —
- `contextId()` — —
- `taskId()` — —
- `referenceTaskIds()` — —
- `extensions()` — —
- `metadata()` — —
- `parsePart()` — —
- `output()` — —
- `parsePartContent()` — —
- `content()` — —
- `qualifier()` — —
- `ensureSupportedMessageContent()` — —
- `normalizeAction()` — —
- `normalized()` — —
- `cloneMessage()` — —
- `clonePart()` — —
- `normalizeUserMessage()` — —
- `STRUCTURAL_TOPICS()` — —
- `declaredCapabilityTopics()` — —
- `topics()` — —
- `locationTopics()` — —
- `aggregateCapabilityTopics()` — —
- `values()` — —
- `aggregateCapabilityOverlap()` — —
- `aggregate()` — —
- `declaration()` — —
- `requested()` — —
- `implemented()` — —
- `overlap()` — —
- `hasCapabilityClaim()` — —
- `isFileAggregate()` — —
- `VALUE_TYPES()` — —
- `CLASSIFICATIONS()` — —
- `SOURCE_KINDS()` — —
- `RISK_CLASSES()` — —
- `objectValue()` — —
- `exactKeys()` — —
- `actual()` — —
- `nonBlank()` — —
- `dateString()` — —
- `uniqueStrings()` — —
- `assertPrincipalList()` — —
- `principals()` — —
- `isJsonValue()` — —
- `assertVariableContract()` — —
- `contract()` — —
- `source()` — —
- `access()` — —
- `readers()` — —
- `writers()` — —
- `assertGeneration()` — —
- `generation()` — —
- `assertAcyclic()` — —
- `ids()` — —
- `visiting()` — —
- `visited()` — —
- `byId()` — —
- `visit()` — —
- `assertOperationPlan()` — —
- `plan()` — —
- `evidence()` — —
- `variables()` — —
- `variableById()` — —
- `steps()` — —
- `stepIds()` — —
- `founderDecisionRequired()` — —
- `step()` — —
- `parameters()` — —
- `reference()` — —
- `variable()` — —
- `rollback()` — —
- `coveredSteps()` — —
- `expectationIds()` — —
- `expectation()` — —
- `verifiedBy()` — —
- `decision()` — —
- `verification()` — —
- `expectedHash()` — —
- `GENERATED_ANALYSIS_BASENAMES()` — —
- `isActionableChangelogRecord()` — —
- `text()` — —
- `paths()` — —
- `isPlaceholder()` — —
- `isFileSummary()` — —
- `isFileOnlyUpdate()` — —
- `match()` — —
- `candidate()` — —
- `basename()` — —
- `isGeneratedAnalysisPath()` — —
- `segments()` — —
- `assertNlExtractionOptions()` — —
- `extractNlIntent()` — —
- `absolute()` — —
- `body()` — —
- `sourcePath()` — —
- `classified()` — —
- `action()` — —
- `object()` — —
- `missing()` — —
- `confidence()` — —
- `inferActor()` — —
- `detectMissingFields()` — —
- `diffIntentGraphs()` — —
- `beforeById()` — —
- `afterById()` — —
- `unchangedRecords()` — —
- `beforeGroups()` — —
- `afterGroups()` — —
- `left()` — —
- `right()` — —
- `paired()` — —
- `beforeRecord()` — —
- `afterRecord()` — —
- `beforeRelations()` — —
- `afterRelations()` — —
- `fingerprint()` — —
- `renderGraphDiffSvg()` — —
- `maxItems()` — —
- `title()` — —
- `visibleRows()` — —
- `width()` — —
- `height()` — —
- `y()` — —
- `assertGraph()` — —
- `groupRecords()` — —
- `groups()` — —
- `identity()` — —
- `values()` — —
- `recordIdentity()` — —
- `normalizeRecord()` — —
- `changedFieldPaths()` — —
- `isObject()` — —
- `relationKey()` — —
- `compareRecords()` — —
- `compareRelations()` — —
- `recordLabel()` — —
- `changeLabel()` — —
- `metricCard()` — —
- `escapeXml()` — —
- `truncate()` — —
- `readListBlock()` — —
- `cursor()` — —
- `line()` — —
- `runPipeline()` — —
- `root()` — —
- `runId()` — —
- `baseOutput()` — —
- `runDirectory()` — —
- `naturalLanguageAudit()` — —
- `result()` — —
- `git()` — —
- `ast()` — —
- `markdown()` — —
- `deterministicDocumentFiles()` — —
- `documentationStartedAt()` — —
- `deterministicDocs()` — —
- `docs()` — —
- `configurationExtraction()` — —
- `includeCommunication()` — —
- `communicationStartedAt()` — —
- `communicationAudit()` — —
- `communicationInputPresent()` — —
- `communication()` — —
- `missingDirectory()` — —
- `allRecords()` — —
- `generatedAt()` — —
- `graph()` — —
- `communicationAnalysis()` — —
- `diagnostics()` — —
- `taskSynthesisMode()` — —
- `taskSynthesisAudit()` — —
- `todoContent()` — —
- `codeChangePlans()` — —
- `codeChangeReview()` — —
- `codeChangeSourcePatches()` — —
- `summaryStartedAt()` — —
- `includeSummaryLlm()` — —
- `summary()` — —
- `filePath()` — —
- `graphPath()` — —
- `diagnosticsPath()` — —
- `summaryPath()` — —
- `summaryConclusionsPath()` — —
- `taskSynthesisPath()` — —
- `todoValidationPath()` — —
- `todoPatchPath()` — —
- `todoPatchAuditPath()` — —
- `codeChangePlansPath()` — —
- `codeChangeReviewPath()` — —
- `codeChangeReviewAuditPath()` — —
- `codeChangeSourcePatchesPath()` — —
- `communicationAnalysisPath()` — —
- `communicationMarkdownPath()` — —
- `configuration()` — —
- `manifestConfiguration()` — —
- `collectTargetHints()` — —
- `values()` — —
- `persistFailedRun()` — —
- `aborted()` — —
- `message()` — —
- `knownAudit()` — —
- `failedAudit()` — —
- `stageValue()` — —
- `reason()` — —
- `failureCode()` — —
- `skippedAudit()` — —
- `appendLlmNotConfigured()` — —
- `tasks()` — —
- `messageTaskIndex()` — —
- `clearA2aTaskStoreForTests()` — —
- `handleA2aRpc()` — —
- `handleRpcInTaskStore()` — —
- `params()` — —
- `sendMessage()` — —
- `message()` — —
- `sendConfiguration()` — —
- `prepared()` — —
- `getTask()` — —
- `task()` — —
- `historyLength()` — —
- `cancelTask()` — —
- `fullTaskView()` — —
- `scheduleTaskExecution()` — —
- `withTaskStore()` — —
- `storePath()` — —
- `release()` — —
- `result()` — —
- `configuredTaskStorePath()` — —
- `acquireTaskStoreLock()` — —
- `deadline()` — —
- `removeLock()` — —
- `removeStaleLock()` — —
- `stat()` — —
- `loadTaskStore()` — —
- `content()` — —
- `snapshot()` — —
- `restored()` — —
- `readTaskStore()` — —
- `restoreTask()` — —
- `assertStoredTask()` — —
- `saveTaskStore()` — —
- `removeTemporaryFile()` — —
- `prepareTask()` — —
- `key()` — —
- `indexedTask()` — —
- `taskForMessage()` — —
- `indexedTaskId()` — —
- `continueTask()` — —
- `existing()` — —
- `continuationError()` — —
- `createTask()` — —
- `taskId()` — —
- `contextId()` — —
- `executeMessage()` — —
- `command()` — —
- `currentTaskState()` — —
- `completeTask()` — —
- `failTask()` — —
- `agentMessage()` — —
- `listTasks()` — —
- `status()` — —
- `pageSize()` — —
- `includeArtifacts()` — —
- `statusTimestampAfter()` — —
- `filter()` — —
- `filtered()` — —
- `pageToken()` — —
- `start()` — —
- `page()` — —
- `last()` — —
- `filteredTasks()` — —
- `compareTasksByUpdate()` — —
- `timestampOrder()` — —
- `indexAfterCursor()` — —
- `exact()` — —
- `cursorTime()` — —
- `next()` — —
- `taskTime()` — —
- `encodeCursor()` — —
- `decodeCursor()` — —
- `decoded()` — —
- `taskView()` — —
- `effectiveHistoryLength()` — —
- `history()` — —
- `cloneArtifact()` — —
- `ownedTask()` — —
- `messageKey()` — —
- `errorMessage()` — —
- `extractMarkdownIntent()` — —
- `pathResolver()` — —
- `todo()` — —
- `changelog()` — —
- `extractTodo()` — —
- `absolute()` — —
- `body()` — —
- `relative()` — —
- `lines()` — —
- `raw()` — —
- `heading()` — —
- `level()` — —
- `task()` — —
- `checked()` — —
- `block()` — —
- `text()` — —
- `classified()` — —
- `action()` — —
- `resolvedPaths()` — —
- `inferOwner()` — —
- `match()` — —
- `extractExplicitId()` — —
- `listIntentRuns()` — —
- `runsDirectory()` — —
- `entries()` — —
- `items()` — —
- `readRunEntries()` — —
- `readRun()` — —
- `runDirectory()` — —
- `graphPath()` — —
- `manifestPath()` — —
- `manifest()` — —
- `safeRunPath()` — —
- `runListItem()` — —
- `files()` — —
- `llm()` — —
- `runtime()` — —
- `warnings()` — —
- `validTimestamp()` — —
- `validStatus()` — —
- `llmSummary()` — —
- `readCommunicationSummary()` — —
- `relative()` — —
- `filePath()` — —
- `stat()` — —
- `value()` — —
- `participants()` — —
- `issues()` — —
- `participantSummary()` — —
- `matchesRunFilters()` — —
- `participant()` — —
- `role()` — —
- `ticket()` — —
- `severity()` — —
- `normalized()` — —
- `stringArray()` — —
- `safeManifestFiles()` — —
- `absolute()` — —
- `relativeApiPath()` — —
- `strings()` — —
- `target()` — —
- `documentRecord()` — —
- `documentResponseContract()` — —
- `documentResponseSchema()` — —
- `execFileAsync()` — —
- `main()` — —
- `parsed()` — —
- `command()` — —
- `config()` — —
- `files()` — —
- `records()` — —
- `graph()` — —
- `graphFile()` — —
- `diagnosticsPath()` — —
- `diagnostics()` — —
- `result()` — —
- `out()` — —
- `graphPath()` — —
- `output()` — —
- `synthesisPath()` — —
- `patch()` — —
- `audit()` — —
- `receipt()` — —
- `actor()` — —
- `approvalHash()` — —
- `plansPath()` — —
- `inputPath()` — —
- `isPlanSet()` — —
- `patchPath()` — —
- `planPath()` — —
- `beforeGraphPath()` — —
- `afterGraphPath()` — —
- `root()` — —
- `handleWatch()` — —
- `taskFile()` — —
- `controller()` — —
- `stop()` — —
- `formatWatchEvent()` — —
- `stamp()` — —
- `handleDiff()` — —
- `mode()` — —
- `svg()` — —
- `html()` — —
- `beforeFile()` — —
- `afterFile()` — —
- `diff()` — —
- `context()` — —
- `maxRows()` — —
- `handleReality()` — —
- `view()` — —
- `markdown()` — —
- `handleExtract()` — —
- `extractor()` — —
- `file()` — —
- `inline()` — —
- `handleCommunication()` — —
- `analysis()` — —
- `graphOut()` — —
- `emitExtraction()` — —
- `emitJson()` — —
- `initProject()` — —
- `moduleRoot()` — —
- `sourceEnv()` — —
- `targetEnv()` — —
- `task()` — —
- `sourceIgnore()` — —
- `targetIgnore()` — —
- `doctor()` — —
- `parseArgs()` — —
- `options()` — —
- `value()` — —
- `next()` — —
- `name()` — —
- `optionString()` — —
- `optionNullableString()` — —
- `optionBoolean()` — —
- `optionNumber()` — —
- `number()` — —
- `optionList()` — —
- `optionNlMode()` — —
- `optionLlmMode()` — —
- `optionTaskMode()` — —
- `optionSummaryMode()` — —
- `optionPipelineTaskMode()` — —
- `reportPipelineDegradation()` — —
- `printHelp()` — —
- `invokedPath()` — —
- `LIVE_HISTORY_LIMIT()` — —
- `liveRequestTimeoutMs()` — —
- `measureLiveStages()` — —
- `missingLiveStages()` — —
- `measureStage()` — —
- `responses()` — —
- `overLatency()` — —
- `sumUsage()` — —
- `values()` — —
- `buildLiveAudit()` — —
- `stages()` — —
- `missingStages()` — —
- `totalLatencyMs()` — —
- `costs()` — —
- `totalCostUsd()` — —
- `overCost()` — —
- `overTotalLatency()` — —
- `buildRecordedLiveAudit()` — —
- `initial()` — —
- `history()` — —
- `toLiveHistoryRecord()` — —
- `appendLiveHistory()` — —
- `kept()` — —
- `summarizeLiveHistory()` — —
- `runs()` — —
- `byStage()` — —
- `entries()` — —
- `redactLiveMessage()` — —
- `renderLiveReport()` — —
- `lines()` — —
- `status()` — —
- `cost()` — —
- `detail()` — —
- `total()` — —
- `median()` — —
- `middle()` — —
- `value()` — —
- `ratio()` — —
- `round()` — —
- `PATH_SEARCH_EXCLUDES()` — —
- `MAX_INDEXED_FILES()` — —
- `createMarkdownPathResolver()` — —
- `repositoryRoot()` — —
- `basenames()` — —
- `headingDirectories()` — —
- `normalized()` — —
- `candidate()` — —
- `matches()` — —
- `isRepositoryPath()` — —
- `absolute()` — —
- `headingScopes()` — —
- `buildBasenameIndex()` — —
- `index()` — —
- `base()` — —
- `seen()` — —
- `directory()` — —
- `execFileAsync()` — —
- `extractGitIntent()` — —
- `root()` — —
- `count()` — —
- `inside()` — —
- `message()` — —
- `commit()` — —
- `changedFiles()` — —
- `stats()` — —
- `diff()` — —
- `classified()` — —
- `inferredSymbols()` — —
- `docOnly()` — —
- `runGit()` — —
- `result()` — —
- `readCommits()` — —
- `output()` — —
- `readChangedFiles()` — —
- `parts()` — —
- `status()` — —
- `readStats()` — —
- `additions()` — —
- `deletions()` — —
- `extractChangedSymbols()` — —
- `symbol()` — —
- `isDocumentationPath()` — —
- `unsupportedSourceWarning()` — —
- `files()` — —
- `counts()` — —
- `extension()` — —
- `OBJECT_PLACEHOLDERS()` — —
- `toDocumentIntentRecord()` — —
- `statementText()` — —
- `target()` — —
- `action()` — —
- `modality()` — —
- `isPlaceholder()` — —
- `resolveObject()` — —
- `fallback()` — —
- `anchorToSource()` — —
- `claimedStart()` — —
- `claimedEnd()` — —
- `wanted()` — —
- `lines()` — —
- `scores()` — —
- `claimedScore()` — —
- `bestScore()` — —
- `bestIndex()` — —
- `anchored()` — —
- `keywordOverlap()` — —
- `present()` — —
- `shared()` — —
- `resolveTarget()` — —
- `hasTarget()` — —
- `resolveAction()` — —
- `derived()` — —
- `resolveModality()` — —
- `linesFromChunk()` — —
- `relativeStart()` — —
- `relativeEnd()` — —
- `clampLine()` — —
- `allowedAction()` — —
- `allowedModality()` — —
- `allowedLifecycle()` — —
- `extractRustAst()` — —
- `helperPath()` — —
- `extractPythonAst()` — —
- `helperPath()` — —
- `matcher()` — —
- `files()` — —
- `temporaryDirectory()` — —
- `filesPath()` — —
- `diagnoseGraph()` — —
- `neighbors()` — —
- `recordsById()` — —
- `groundedImplementation()` — —
- `implementedPaths()` — —
- `documentedPaths()` — —
- `symbolResolutionIndex()` — —
- `related()` — —
- `evidenced()` — —
- `hasLocationOnlyEvidence()` — —
- `missingFields()` — —
- `symbolIssues()` — —
- `detail()` — —
- `indexGroundedImplementationEvidence()` — —
- `grounded()` — —
- `left()` — —
- `right()` — —
- `relationSupportsImplementation()` — —
- `basis()` — —
- `score()` — —
- `ambiguityDetail()` — —
- `paths()` — —
- `ambiguityAction()` — —
- `actions()` — —
- `buildNeighbors()` — —
- `map()` — —
- `appendNeighbor()` — —
- `values()` — —
- `indexImplementedPaths()` — —
- `indexDocumentedPaths()` — —
- `hasImplementedTarget()` — —
- `hasDocumentedTarget()` — —
- `isPlan()` — —
- `isImplementationEvidence()` — —
- `isPublicImplementation()` — —
- `symbol()` — —
- `isReleaseCandidate()` — —
- `isImportantRecord()` — —
- `makeDiagnostic()` — —
- `severityRank()` — —
- `extractPhpAst()` — —
- `helperPath()` — —
- `matcher()` — —
- `files()` — —
- `temporaryDirectory()` — —
- `filesPath()` — —
- `extractJavaAst()` — —
- `helperPath()` — —
- `prioritizeDocumentChunks()` — —
- `needles()` — —
- `chunkPriority()` — —
- `matches()` — —
- `mapConcurrent()` — —
- `results()` — —
- `nextIndex()` — —
- `worker()` — —
- `index()` — —
- `item()` — —
- `workerCount()` — —
- `chunkMarkdown()` — —
- `lines()` — —
- `sections()` — —
- `currentStart()` — —
- `currentEnd()` — —
- `flush()` — —
- `sectionLines()` — —
- `sectionText()` — —
- `candidateSize()` — —
- `markdownSections()` — —
- `sectionStart()` — —
- `splitLongSection()` — —
- `batchStart()` — —
- `batch()` — —
- `takeLineBatch()` — —
- `size()` — —
- `offset()` — —
- `line()` — —
- `extractGoAst()` — —
- `helperPath()` — —
- `extractTypeScriptFile()` — —
- `relative()` — —
- `sourceFile()` — —
- `moduleCapabilities()` — —
- `lineRange()` — —
- `excerpt()` — —
- `add()` — —
- `symbol()` — —
- `nameOf()` — —
- `modifiers()` — —
- `visit()` — —
- `symbolModifiers()` — —
- `declarationIsCallable()` — —
- `callee()` — —
- `capabilities()` — —
- `isTopLevel()` — —
- `scriptKind()` — —
- `extension()` — —
- `languageName()` — —
- `MARKDOWN_LLM_BATCH_RECORDS()` — —
- `extractAstIntent()` — —
- `root()` — —
- `cache()` — —
- `matcher()` — —
- `files()` — —
- `body()` — —
- `relative()` — —
- `extracted()` — —
- `adapterFiles()` — —
- `manifest()` — —
- `result()` — —
- `unsupported()` — —
- `sourceManifest()` — —
- `isIntentRecords()` — —
- `isExtractionResult()` — —
- `emptyCounts()` — —
- `addCounts()` — —
- `compareSets()` — —
- `actualCounts()` — —
- `expectedCounts()` — —
- `counts()` — —
- `actualCount()` — —
- `expectedCount()` — —
- `frequency()` — —
- `metric()` — —
- `ratio()` — —
- `main()` — —
- `args()` — —
- `arg()` — —
- `json()` — —
- `requirePerfect()` — —
- `outIndex()` — —
- `outPath()` — —
- `dataset()` — —
- `report()` — —
- `rendered()` — —
- `execFileAsync()` — —
- `runExternalAstAdapter()` — —
- `files()` — —
- `result()` — —
- `parsed()` — —
- `runExtractionCase()` — —
- `root()` — —
- `config()` — —
- `writeFixtureFiles()` — —
- `destination()` — —
- `extractNlCase()` — —
- `extractMarkdownCase()` — —
- `extractDeterministicDocumentationCase()` — —
- `files()` — —
- `extractDocumentationCase()` — —
- `originalFetch()` — —
- `benchmarkConfig()` — —
- `projectRecord()` — —
- `escapeXml()` — —
- `truncate()` — —
- `sanitizeSourceLine()` — —
- `metricCard()` — —
- `svgStyles()` — —
- `svgDocument()` — —
- `theme()` — —
- `extractChangelog()` — —
- `absolute()` — —
- `body()` — —
- `relative()` — —
- `lines()` — —
- `raw()` — —
- `versionHeading()` — —
- `categoryHeading()` — —
- `bullet()` — —
- `block()` — —
- `text()` — —
- `action()` — —
- `resolvedPaths()` — —
- `changelogAction()` — —
- `normalized()` — —
- `lower()` — —
- `MAX_HEADING_LEVEL()` — —
- `MIN_STATEMENT_CHARS()` — —
- `extractDocumentationBaseline()` — —
- `root()` — —
- `resolver()` — —
- `body()` — —
- `primePathMapper()` — —
- `resolved()` — —
- `mapped()` — —
- `convertDocument()` — —
- `relative()` — —
- `lines()` — —
- `raw()` — —
- `fenceMatch()` — —
- `marker()` — —
- `language()` — —
- `record()` — —
- `heading()` — —
- `level()` — —
- `title()` — —
- `bullet()` — —
- `block()` — —
- `paragraph()` — —
- `readParagraph()` — —
- `cursor()` — —
- `line()` — —
- `qualifyingStatement()` — —
- `target()` — —
- `hasCodeSpanIdentifier()` — —
- `statementRecord()` — —
- `action()` — —
- `codeBlockRecord()` — —
- `targetsOf()` — —
- `adapterRecords()` — —
- `detailRecords()` — —
- `moduleRecords()` — —
- `byPath()` — —
- `bucket()` — —
- `start()` — —
- `end()` — —
- `capabilities()` — —
- `boundedCapabilities()` — —
- `moduleTopicText()` — —
- `loadGoldDataset()` — —
- `parsed()` — —
- `evaluateGoldDataset()` — —
- `first()` — —
- `second()` — —
- `stable()` — —
- `goldReportIsPerfect()` — —
- `renderGoldReportMarkdown()` — —
- `percent()` — —
- `support()` — —
- `rows()` — —
- `value()` — —
- `evaluateOnce()` — —
- `extraction()` — —
- `linking()` — —
- `dsl2todo()` — —
- `diagnostics()` — —
- `evaluateExtraction()` — —
- `byChannel()` — —
- `actual()` — —
- `overall()` — —
- `evaluateDiagnostics()` — —
- `counts()` — —
- `forbiddenViolations()` — —
- `snapshots()` — —
- `result()` — —
- `evaluateLinking()` — —
- `byClass()` — —
- `reranking()` — —
- `evaluateDsl2Todo()` — —
- `duplicateCounts()` — —
- `assertGoldDataset()` — —
- `dataset()` — —
- `assertDatasetObject()` — —
- `assertDatasetMetadata()` — —
- `assertDatasetCollections()` — —
- `assertUniqueCaseIds()` — —
- `assertExtractionCoverage()` — —
- `channels()` — —
- `assertLinkingCohorts()` — —
- `labels()` — —
- `modules()` — —
- `GENERIC_SYMBOLS()` — —
- `GENERIC_FILES()` — —
- `normalizeTarget()` — —
- `normalizePath()` — —
- `normalizeSymbol()` — —
- `symbolAliases()` — —
- `normalized()` — —
- `parts()` — —
- `leaf()` — —
- `pathAliases()` — —
- `basename()` — —
- `unique()` — —
- `executeAction()` — —
- `root()` — —
- `file()` — —
- `text()` — —
- `analysis()` — —
- `records()` — —
- `graph()` — —
- `diagnostics()` — —
- `result()` — —
- `output()` — —
- `synthesis()` — —
- `todoPath()` — —
- `patchPath()` — —
- `auditPath()` — —
- `todoContent()` — —
- `rendered()` — —
- `receiptPath()` — —
- `conclusions()` — —
- `proposals()` — —
- `planSet()` — —
- `review()` — —
- `plan()` — —
- `unifiedDiffs()` — —
- `patch()` — —
- `beforeGraph()` — —
- `beforeDiagnostics()` — —
- `afterGraph()` — —
- `afterDiagnostics()` — —
- `value()` — —
- `beforeInput()` — —
- `afterInput()` — —
- `before()` — —
- `after()` — —
- `diff()` — —
- `svg()` — —
- `beforePath()` — —
- `afterPath()` — —
- `view()` — —
- `filterCommunicationGraph()` — —
- `participant()` — —
- `role()` — —
- `ticket()` — —
- `communicationOnly()` — —
- `isCommunication()` — —
- `nlModeValue()` — —
- `llmModeValue()` — —
- `taskSynthesisMode()` — —
- `summaryModeValue()` — —
- `pipelineTaskMode()` — —
- `withTextDiffViews()` — —
- `title()` — —
- `readGraphInput()` — —
- `safePath()` — —
- `readActionObject()` — —
- `resolveRoot()` — —
- `requested()` — —
- `scopedPath()` — —
- `selected()` — —
- `nullableScopedPath()` — —
- `readRecords()` — —
- `files()` — —
- `safeFile()` — —
- `stringValue()` — —
- `nullableString()` — —
- `stringList()` — —
- `numberValue()` — —
- `number()` — —
- `hasInputValue()` — —
- `objectMapOfStrings()` — —
- `booleanValue()` — —
- `objectValue()` — —
- `registerRunArtifacts()` — —
- `manifestPath()` — —
- `manifest()` — —
- `execFileAsync()` — —
- `BINARY_EXTENSIONS()` — —
- `collectGitDiff()` — —
- `root()` — —
- `revision()` — —
- `staged()` — —
- `maxFiles()` — —
- `inside()` — —
- `beforePath()` — —
- `before()` — —
- `after()` — —
- `diff()` — —
- `parseNameStatus()` — —
- `parts()` — —
- `status()` — —
- `isProbablyBinary()` — —
- `readBlob()` — —
- `readStagedBlob()` — —
- `readWorkingFile()` — —
- `runGit()` — —
- `result()` — —
- `buildRecord()` — —
- `rawExcerpt()` — —
- `withRecordGeneration()` — —
- `generationMetadata()` — —
- `used()` — —
- `extractorIdentity()` — —
- `separator()` — —
- `clamp()` — —
- `sourcePrefix()` — —
- `assertPathWithinRoot()` — —
- `rootAbsolute()` — —
- `candidateAbsolute()` — —
- `existingAncestor()` — —
- `ancestorReal()` — —
- `assertDescendant()` — —
- `relative()` — —
- `nearestExistingPath()` — —
- `current()` — —
- `code()` — —
- `parent()` — —
- `groundRecordIdsByDiagnostics()` — —
- `diagnosticById()` — —
- `allowed()` — —
- `suppliedGrounded()` — —
- `sortedUnique()` — —
- `compileIgnorePattern()` — —
- `pattern()` — —
- `negated()` — —
- `directoryOnly()` — —
- `anchored()` — —
- `body()` — —
- `prefix()` — —
- `translateGlob()` — —
- `char()` — —
- `next()` — —
- `close()` — —
- `escapeLiteral()` — —
- `parseIgnoreFile()` — —
- `createIgnoreMatcher()` — —
- `normalize()` — —
- `decide()` — —
- `target()` — —
- `segments()` — —
- `ancestor()` — —
- `loadIgnoreMatcher()` — —
- `files()` — —
- `absolute()` — —
- `rule()` — —
- `extractCommunicationIntent()` — —
- `root()` — —
- `projectRoot()` — —
- `files()` — —
- `identityRegistry()` — —
- `communicationFiles()` — —
- `relativeToProject()` — —
- `parts()` — —
- `pathTicket()` — —
- `envelope()` — —
- `inferred()` — —
- `explicitEnvelope()` — —
- `declaredParticipant()` — —
- `declaredRole()` — —
- `declaredParticipantId()` — —
- `identity()` — —
- `participant()` — —
- `role()` — —
- `displayName()` — —
- `explicitMessageType()` — —
- `messageType()` — —
- `ticket()` — —
- `recipient()` — —
- `timestamp()` — —
- `declaredGitAuthors()` — —
- `gitAuthors()` — —
- `declaredA2aAgentId()` — —
- `explicitPaths()` — —
- `explicitSymbols()` — —
- `segments()` — —
- `segmentType()` — —
- `semantics()` — —
- `classified()` — —
- `action()` — —
- `line()` — —
- `resolveIdentity()` — —
- `sameStrings()` — —
- `normalize()` — —
- `parseEnvelope()` — —
- `lines()` — —
- `end()` — —
- `match()` — —
- `inferIdentity()` — —
- `basename()` — —
- `governance()` — —
- `fileParts()` — —
- `nestedRoleIndex()` — —
- `nestedRole()` — —
- `nestedParticipant()` — —
- `isTicketEvidenceFile()` — —
- `communicationSegments()` — —
- `flush()` — —
- `item()` — —
- `raw()` — —
- `heading()` — —
- `cleaned()` — —
- `isCommunicationNoise()` — —
- `normalized()` — —
- `governanceSectionType()` — —
- `looksLikeTicket()` — —
- `normalizeRole()` — —
- `normalizeType()` — —
- `isCommunicationType()` — —
- `semanticsFor()` — —
- `first()` — —
- `listValue()` — —
- `stripped()` — —
- `unquote()` — —
- `validTimestamp()` — —
- `parsed()` — —
- `DEFAULT_IGNORED_DIRS()` — —
- `ensureDir()` — —
- `readText()` — —
- `stat()` — —
- `pathExists()` — —
- `writeJson()` — —
- `writeText()` — —
- `writeJsonl()` — —
- `readJsonl()` — —
- `body()` — —
- `readJson()` — —
- `walkFiles()` — —
- `ignored()` — —
- `extensions()` — —
- `maxFiles()` — —
- `matcher()` — —
- `base()` — —
- `visit()` — —
- `entries()` — —
- `absolute()` — —
- `relative()` — —
- `extension()` — —
- `escapeRegex()` — —
- `globToRegExp()` — —
- `normalized()` — —
- `char()` — —
- `next()` — —
- `after()` — —
- `matchesAnyGlob()` — —
- `resolveGlobs()` — —
- `files()` — —
- `relativePosix()` — —
- `stableStringify()` — —
- `sortValue()` — —
- `sha256()` — —
- `shortHash()` — —
- `createIntentId()` — —
- `createRelationId()` — —
- `createConclusionId()` — —
- `createTodoProposalId()` — —
- `createCodeChangePlanHash()` — —
- `createCodeChangePlanId()` — —
- `createCodeChangeSourcePatchHash()` — —
- `createCodeChangeSourcePatchId()` — —
- `graphFingerprint()` — —
- `newRunId()` — —
- `stamp()` — —
- `asJsonValue()` — —
- `DEFAULT_CONTEXT()` — —
- `DEFAULT_MAX_COMPARE_LINES()` — —
- `splitLines()` — —
- `normalized()` — —
- `lines()` — —
- `diffText()` — —
- `diffLineArrays()` — —
- `context()` — —
- `maxCompareLines()` — —
- `beforePath()` — —
- `afterPath()` — —
- `summarizeLines()` — —
- `computeLineDiff()` — —
- `prefix()` — —
- `suffix()` — —
- `middleBefore()` — —
- `middleAfter()` — —
- `truncated()` — —
- `middleOps()` — —
- `sharedPrefixLength()` — —
- `sharedSuffixLength()` — —
- `prefixLines()` — —
- `suffixLines()` — —
- `beforeIndex()` — —
- `afterIndex()` — —
- `blockReplace()` — —
- `myers()` — —
- `n()` — —
- `m()` — —
- `max()` — —
- `offset()` — —
- `v()` — —
- `y()` — —
- `backtrack()` — —
- `x()` — —
- `k()` — —
- `previousK()` — —
- `previousX()` — —
- `previousY()` — —
- `buildHunks()` — —
- `changeIndexes()` — —
- `start()` — —
- `end()` — —
- `last()` — —
- `hunkFromRange()` — —
- `slice()` — —
- `beforeNumbers()` — —
- `afterNumbers()` — —
- `evaluateLinkingCase()` — —
- `idToLabel()` — —
- `graph()` — —
- `observed()` — —
- `actual()` — —
- `expected()` — —
- `byClass()` — —
- `forbidden()` — —
- `forbiddenViolations()` — —
- `evaluateRerankingCase()` — —
- `declarationRecordId()` — —
- `candidates()` — —
- `moduleRecordId()` — —
- `candidateByModule()` — —
- `decisions()` — —
- `candidate()` — —
- `rerank()` — —
- `augmented()` — —
- `classifyRelation()` — —
- `exact()` — —
- `evaluateDiagnosticsCase()` — —
- `report()` — —
- `evaluateDsl2TodoCase()` — —
- `diagnostics()` — —
- `diagnosticIds()` — —
- `conclusion()` — —
- `proposals()` — —
- `validation()` — —
- `duplicateIds()` — —
- `citations()` — —
- `buildConclusion()` — —
- `buildProposal()` — —
- `recordIds()` — —
- `id()` — —
- `countCitations()` — —
- `citationRequired()` — —
- `citationCited()` — —
- `buildFixtureRecords()` — —
- `labels()` — —
- `records()` — —
- `record()` — —
- `deterministicGeneration()` — —
- `IMPLEMENTATION_DIAGNOSTIC_CODES()` — —
- `proposeCodeChangePlans()` — —
- `generatedAt()` — —
- `maxPlans()` — —
- `conclusions()` — —
- `proposals()` — —
- `recordsById()` — —
- `proposalsByDiagnostic()` — —
- `conclusionsByDiagnostic()` — —
- `candidates()` — —
- `relatedRecords()` — —
- `matchingProposals()` — —
- `matchingConclusions()` — —
- `target()` — —
- `changes()` — —
- `generation()` — —
- `planHash()` — —
- `createRepositoryPathProbe()` — —
- `base()` — —
- `absolute()` — —
- `implementationDiagnosticRank()` — —
- `evaluateCodeChangeAcceptance()` — —
- `afterDiagnostics()` — —
- `beforeIds()` — —
- `afterById()` — —
- `targeted()` — —
- `clearedDiagnosticIds()` — —
- `remainingDiagnosticIds()` — —
- `newBlockingDiagnosticIds()` — —
- `accepted()` — —
- `evaluatedAt()` — —
- `closeCodeChanges()` — —
- `planIds()` — —
- `acceptances()` — —
- `acceptedCount()` — —
- `indexProposalsByDiagnostic()` — —
- `index()` — —
- `list()` — —
- `indexConclusionsByDiagnostic()` — —
- `collectTarget()` — —
- `paths()` — —
- `symbols()` — —
- `tickets()` — —
- `versions()` — —
- `buildChanges()` — —
- `sourceIntents()` — —
- `rationale()` — —
- `normalized()` — —
- `exists()` — —
- `titleFor()` — —
- `record()` — —
- `object()` — —
- `startsWithImperative()` — —
- `descriptionFor()` — —
- `acceptanceCriteriaFor()` — —
- `priorityFor()` — —
- `confidenceFor()` — —
- `riskFor()` — —
- `level()` — —
- `rollbackFor()` — —
- `deterministicGeneration()` — —
- `uniqueSorted()` — —
- `createCodeChangeReviewPatch()` — —
- `createdAt()` — —
- `markdown()` — —
- `renderCodeChangeReviewMarkdown()` — —
- `assertCodeChangeReviewPatch()` — —
- `artifact()` — —
- `priorityRank()` — —
- `inline()` — —
- `renderIds()` — —
- `createCodeChangeSourcePatch()` — —
- `plan()` — —
- `graphFingerprint()` — —
- `allowed()` — —
- `diffs()` — —
- `path()` — —
- `rawDiff()` — —
- `unifiedDiff()` — —
- `patchHash()` — —
- `createCodeChangeSourcePatchSet()` — —
- `assertCodeChangeSourcePatch()` — —
- `patch()` — —
- `expectedHash()` — —
- `expectedChanges()` — —
- `editPath()` — —
- `assertCodeChangeSourcePatchSet()` — —
- `set()` — —
- `plansById()` — —
- `patchIds()` — —
- `exactSourcePatchKeys()` — —
- `actual()` — —
- `assertSourcePatchIds()` — —
- `assertSourcePatchStrings()` — —
- `exactSourcePatchSet()` — —
- `instructionFor()` — —
- `criteria()` — —
- `normalizeUnifiedDiff()` — —
- `bare()` — —
- `stripped()` — —
- `applyCodeChangeSourcePatch()` — —
- `root()` — —
- `receiptPath()` — —
- `existing()` — —
- `relative()` — —
- `before()` — —
- `after()` — —
- `now()` — —
- `fileHashesAfter()` — —
- `assertExistingSourceReceipt()` — —
- `current()` — —
- `assertSourceApplyReceipt()` — —
- `expectedPaths()` — —
- `hashPaths()` — —
- `atomicWriteRaw()` — —
- `applyUnifiedDiffToText()` — —
- `normalizedDiff()` — —
- `baseLines()` — —
- `diffLines()` — —
- `cursor()` — —
- `oldIndex()` — —
- `oldCount()` — —
- `newCount()` — —
- `mark()` — —
- `body()` — —
- `splitKeep()` — —
- `lines()` — —
- `loadParticipantIdentityRegistry()` — —
- `registryPath()` — —
- `assertParticipantIdentityRegistry()` — —
- `registry()` — —
- `ids()` — —
- `external()` — —
- `entry()` — —
- `values()` — —
- `normalized()` — —
- `owner()` — —
- `exactKeys()` — —
- `allowed()` — —
- `missing()` — —
- `extra()` — —
- `renderUnifiedDiff()` — —
- `marker()` — —
- `toSideBySideRows()` — —
- `index()` — —
- `line()` — —
- `pairs()` — —
- `renderTextDiffSvg()` — —
- `theme()` — —
- `maxRows()` — —
- `maxColumns()` — —
- `title()` — —
- `charWidth()` — —
- `rowHeight()` — —
- `gutterWidth()` — —
- `columnWidth()` — —
- `width()` — —
- `totals()` — —
- `y()` — —
- `rendered()` — —
- `skipped()` — —
- `summarizeDiffs()` — —
- `diffHeading()` — —
- `svgBody()` — —
- `sideBySideRowMarkup()` — —
- `changed()` — —
- `number()` — —
- `renderTextDiffHtml()` — —
- `sections()` — —
- `renderHtmlSection()` — —
- `hunks()` — —
- `rows()` — —
- `htmlCell()` — —
- `cssClass()` — —
- `MAX_ENTRIES_PER_FILE()` — —
- `extractConfigurationIntent()` — —
- `root()` — —
- `matcher()` — —
- `discovered()` — —
- `files()` — —
- `relative()` — —
- `body()` — —
- `isConfigurationPath()` — —
- `base()` — —
- `configurationRecords()` — —
- `entries()` — —
- `bounded()` — —
- `fileAggregate()` — —
- `format()` — —
- `lastLine()` — —
- `configurationFormat()` — —
- `jsonEntries()` — —
- `parsed()` — —
- `lines()` — —
- `tomlEntries()` — —
- `line()` — —
- `heading()` — —
- `pair()` — —
- `yamlOrAssignmentEntries()` — —
- `yaml()` — —
- `assignment()` — —
- `key()` — —
- `dockerEntries()` — —
- `match()` — —
- `instruction()` — —
- `detail()` — —
- `entry()` — —
- `uniqueEntries()` — —
- `seen()` — —
- `findKeyLine()` — —
- `pattern()` — —
- `index()` — —
- `loadEnvFile()` — —
- `explicit()` — —
- `candidates()` — —
- `content()` — —
- `trimmed()` — —
- `separator()` — —
- `key()` — —
- `value()` — —
- `envString()` — —
- `envOptional()` — —
- `envNumber()` — —
- `raw()` — —
- `envBoolean()` — —
- `envList()` — —
- `envLlmMode()` — —
- `getConfig()` — —
- `model()` — —
- `root()` — —
- `configForDisplay()` — —
- `hasOpenRouter()` — —
- `indexKeywords()` — —
- `jaccard()` — —
- `intersection()` — —
- `linkIntentRecords()` — —
- `records()` — —
- `byId()` — —
- `keywordIndex()` — —
- `symbolResolutionIndex()` — —
- `candidatePairs()` — —
- `resolvableBasenames()` — —
- `left()` — —
- `right()` — —
- `evidence()` — —
- `directed()` — —
- `deduplicateRecords()` — —
- `existing()` — —
- `collectCandidatePairs()` — —
- `buckets()` — —
- `astIds()` — —
- `moduleAstIds()` — —
- `declarationAstIds()` — —
- `configurationIds()` — —
- `isModuleTopicSource()` — —
- `indexTargetBuckets()` — —
- `indexAliases()` — —
- `indexKeywordBuckets()` — —
- `indexTopicBuckets()` — —
- `addToBucket()` — —
- `values()` — —
- `isSuppressedConfigurationPair()` — —
- `pairsFromBuckets()` — —
- `output()` — —
- `leftId()` — —
- `rightId()` — —
- `isSuppressedAstPair()` — —
- `leftAst()` — —
- `rightAst()` — —
- `astId()` — —
- `indexResolvableBasenames()` — —
- `owners()` — —
- `normalized()` — —
- `basename()` — —
- `paths()` — —
- `pathsIntersect()` — —
- `expand()` — —
- `aliases()` — —
- `full()` — —
- `leftSet()` — —
- `scorePair()` — —
- `score()` — —
- `leftKeywords()` — —
- `rightKeywords()` — —
- `resolvedNlAstSymbol()` — —
- `capabilityOverlap()` — —
- `objectSimilarity()` — —
- `sharedTopics()` — —
- `intersectionSize()` — —
- `size()` — —
- `isFileAggregateEvidencePair()` — —
- `isModuleTopicEvidencePair()` — —
- `determineRelation()` — —
- `textScore()` — —
- `sourceRelation()` — —
- `relationForSourceKinds()` — —
- `relation()` — —
- `matchSourceRule()` — —
- `orientRelation()` — —
- `intersects()` — —
- `set()` — —
- `intersectsAliases()` — —
- `countBy()` — —
- `key()` — —
- `baseUrl()` — —
- `token()` — —
- `root()` — —
- `main()` — —
- `client()` — —
- `health()` — —
- `card()` — —
- `nl()` — —
- `ast()` — —
- `markdown()` — —
- `graph()` — —
- `diagnostics()` — —
- `synthesis()` — —
- `validation()` — —
- `rendered()` — —
- `artifact()` — —
- `reality()` — —
- `gitDiff()` — —
- `comparison()` — —
- `buildRealityView()` — —
- `components()` — —
- `diagnosticsByRecord()` — —
- `codes()` — —
- `status()` — —
- `bySeverity()` — —
- `alignment()` — —
- `bySize()` — —
- `declaredRecords()` — —
- `observedRecords()` — —
- `aligned()` — —
- `declaredTopics()` — —
- `observedTopics()` — —
- `implementationAlignedTopics()` — —
- `documentedObservedTopics()` — —
- `ratio()` — —
- `documentedCoverageLabel()` — —
- `LABEL_CHAR()` — —
- `BADGE_CHAR()` — —
- `widestLabel()` — —
- `groupIntoTopics()` — —
- `symbolPaths()` — —
- `anchors()` — —
- `groups()` — —
- `key()` — —
- `bucket()` — —
- `indexModuleAnchors()` — —
- `modulePaths()` — —
- `targetless()` — —
- `candidates()` — —
- `path()` — —
- `values()` — —
- `resolvesToFile()` — —
- `resolved()` — —
- `indexUnambiguousSymbolPaths()` — —
- `paths()` — —
- `primaryTargetKey()` — —
- `anchor()` — —
- `indexDiagnostics()` — —
- `index()` — —
- `resolveEvidence()` — —
- `resolveStatus()` — —
- `declared()` — —
- `observed()` — —
- `changelog()` — —
- `topicLabel()` — —
- `separator()` — —
- `value()` — —
- `object()` — —
- `renderRealitySvg()` — —
- `theme()` — —
- `maxRows()` — —
- `title()` — —
- `rows()` — —
- `visible()` — —
- `laneX()` — —
- `laneStep()` — —
- `statusX()` — —
- `statusWidth()` — —
- `width()` — —
- `rowHeight()` — —
- `headerY()` — —
- `y()` — —
- `isDeclared()` — —
- `color()` — —
- `count()` — —
- `cx()` — —
- `fill()` — —
- `label()` — —
- `pillWidth()` — —
- `renderRealityMarkdown()` — —
- `lanes()` — —
- `escapeMarkdown()` — —
- `STOP_WORDS()` — —
- `classifyActionHeuristically()` — —
- `conventional()` — —
- `prose()` — —
- `searchable()` — —
- `detectModality()` — —
- `matches()` — —
- `detectPolarity()` — —
- `stripped()` — —
- `normalized()` — —
- `normalizeToken()` — —
- `keywords()` — —
- `GENERIC_TOPICS()` — —
- `topicKeywords()` — —
- `separated()` — —
- `foldTopicToken()` — —
- `aliased()` — —
- `singular()` — —
- `similarity()` — —
- `left()` — —
- `right()` — —
- `intersection()` — —
- `extractBacktickValues()` — —
- `value()` — —
- `extractPaths()` — —
- `FILE_EXTENSIONS()` — —
- `hasFileExtension()` — —
- `last()` — —
- `dot()` — —
- `PATH_ROOTS()` — —
- `isPathLike()` — —
- `segments()` — —
- `HOST_TLDS()` — —
- `isHostname()` — —
- `parts()` — —
- `tld()` — —
- `extractSymbols()` — —
- `repositoryPaths()` — —
- `backticks()` — —
- `camel()` — —
- `ticketPrefixes()` — —
- `extractTickets()` — —
- `values()` — —
- `extractVersions()` — —
- `inferObject()` — —
- `result()` — —
- `splitIntentLines()` — —
- `lines()` — —
- `raw()` — —
- `cleaned()` — —
- `pieces()` — —
- `unwrapTask()` — —
- `main()` — —
- `run()` — —
- `envOr()` — —
- `truncate()` — —
- `joinedIDs()` — —
- `New()` — —
- `nextID()` — —
- `setHeaders()` — —
- `RPC()` — —
- `Send()` — —
- `unwrapTask()` — —
- `Call()` — —
- `Health()` — —
- `AgentCard()` — —
- `getJSON()` — —
- `execFileAsync()` — —
- `compareWorkspaceIntent()` — —
- `root()` — —
- `repositoryRoot()` — —
- `relativeAnalysisRoot()` — —
- `outputDir()` — —
- `baseRef()` — —
- `baseCommit()` — —
- `headCommit()` — —
- `status()` — —
- `changedFiles()` — —
- `temporaryParent()` — —
- `baseWorktree()` — —
- `baseRoot()` — —
- `pipelineOptions()` — —
- `baseOptions()` — —
- `currentOptions()` — —
- `baseRun()` — —
- `currentRun()` — —
- `baseReality()` — —
- `currentReality()` — —
- `diff()` — —
- `baseCoverage()` — —
- `currentCoverage()` — —
- `alignmentRateDelta()` — —
- `implementationCoverageDelta()` — —
- `plannedCodeCoverageDelta()` — —
- `documentedCodeCoverageDelta()` — —
- `gapsDelta()` — —
- `diagnosticsDelta()` — —
- `comparisonId()` — —
- `comparisonDirectory()` — —
- `artifacts()` — —
- `scopedOutputDirectory()` — —
- `absolute()` — —
- `commonPipelineOptions()` — —
- `optionsForRoot()` — —
- `existingFile()` — —
- `relative()` — —
- `coverage()` — —
- `diagnosticDelta()` — —
- `classifyWorkspaceTrend()` — —
- `severeDelta()` — —
- `improved()` — —
- `regressed()` — —
- `parseAheadBehind()` — —
- `defaultBaseRef()` — —
- `rounded()` — —
- `artifactPaths()` — —
- `renderTrendMarkdown()` — —
- `percent()` — —
- `documentationLine()` — —
- `git()` — —
- `result()` — —
- `root()` — —
- `sourceRoot()` — —
- `files()` — —
- `structuredCalls()` — —
- `source()` — —
- `typescriptFiles()` — —
- `absolute()` — —
- `explicit()` — —
- `files()` — —
- `body()` — —
- `seen()` — —
- `match()` — —
- `key()` — —
- `previous()` — —
- `workflowFiles()` — —
- `directory()` — —
- `Generation()` — —
- `Error()` — —
- `visited()` — —
- `visit()` — —
- `body()` — —
- `resolved()` — —
- `resolveSource()` — —
- `raw()` — —
- `analyzeCommunication()` — —
- `communication()` — —
- `evidenceByRecord()` — —
- `participants()` — —
- `participant()` — —
- `values()` — —
- `left()` — —
- `right()` — —
- `leftRole()` — —
- `rightRole()` — —
- `code()` — —
- `responseRequiredFrom()` — —
- `humanRequests()` — —
- `agentMessages()` — —
- `response()` — —
- `type()` — —
- `participantGit()` — —
- `linked()` — —
- `matchedRequest()` — —
- `aliases()` — —
- `matchedGit()` — —
- `evidence()` — —
- `validateSyntheses()` — —
- `byId()` — —
- `ids()` — —
- `record()` — —
- `renderCommunicationMarkdown()` — —
- `addCommunicationIssuesToDiagnostics()` — —
- `hasSerious()` — —
- `communicationIssueTitle()` — —
- `evidenceNeighbors()` — —
- `records()` — —
- `output()` — —
- `isEvidenceRecord()` — —
- `matchedGitRecords()` — —
- `semanticMatch()` — —
- `conflictSemanticMatch()` — —
- `leftHasExplicitTarget()` — —
- `rightHasExplicitTarget()` — —
- `agentResponseCoversRequest()` — —
- `candidates()` — —
- `bySource()` — —
- `aggregateTopicMatch()` — —
- `requested()` — —
- `shared()` — —
- `agentWorkCoveredByHumanScope()` — —
- `requests()` — —
- `sourceRecords()` — —
- `plans()` — —
- `agentSourceRecords()` — —
- `isBroadRequest()` — —
- `isActionableAgentWork()` — —
- `isPositiveImplementationClaim()` — —
- `isHumanDecisionClaim()` — —
- `hasImplementationVerb()` — —
- `withoutTickets()` — —
- `value()` — —
- `intersects()` — —
- `participantOf()` — —
- `participantsForRole()` — —
- `roleOf()` — —
- `typeOf()` — —
- `ticketOf()` — —
- `gitAliases()` — —
- `normalizeIdentity()` — —
- `append()` — —
- `issue()` — —
- `sortedRespondents()` — —
- `explicitResponseRoute()` — —
- `severityRank()` — —
- `escapeCell()` — —
- `escapeRegex()` — —
- `execFileAsync()` — —
- `root()` — —
- `projectDirectory()` — —
- `textExtensions()` — —
- `untracked()` — —
- `tracked()` — —
- `generatedRelative()` — —
- `trackedReferences()` — —
- `relative()` — —
- `content()` — —
- `normalizePath()` — —
- `referencesAlreadyInTrackedSources()` — —
- `referenced()` — —
- `text()` — —
- `root()` — —
- `readmePath()` — —
- `relativeReadme()` — —
- `packagePath()` — —
- `packageJson()` — —
- `version()` — —
- `license()` — —
- `nodeVersion()` — —
- `original()` — —
- `synchronized()` — —
- `licenseTarget()` — —
- `requiredString()` — —
- `replaceRequired()` — —
- `badgeValue()` — —
- `root()` — —
- `sourceRoot()` — —
- `textExtensions()` — —
- `projectDirectory()` — —
- `changed()` — —
- `original()` — —
- `normalized()` — —
- `ExtractAST()` — —
- `ExtractConfig()` — —
- `ExtractNL()` — —
- `ExtractDocs()` — —
- `ExtractMarkdown()` — —
- `ExtractMarkdownWithOptions()` — —
- `ExtractGit()` — —
- `Link()` — —
- `Diagnose()` — —
- `Reality()` — —
- `DiffGit()` — —
- `DiffFiles()` — —
- `CompareWorkspace()` — —
- `Pipeline()` — —
- `ProposeTodo()` — —
- `RenderTodo()` — —
- `ApplyTodo()` — —
- `callMap()` — —
- `root()` — —
- `examplePath()` — —
- `example()` — —
- `declared()` — —
- `match()` — —
- `expected()` — —
- `configBody()` — —
- `body()` — —
- `makefile()` — —
- `local()` — —
- `auditLocalKeys()` — —
- `keys()` — —
- `collectExisting()` — —
- `absolute()` — —
- `collect()` — —
- `cleanup()` — —
- `record_sdk_log()` — —
- `run_sdk()` — —
- `fail()` — —
- `require_command()` — —
- `run_step()` — —
- `cleanup()` — —
- `root()` — —
- `outputPath()` — —
- `publishedDocumentMaximum()` — —
- `current()` — —
- `REPO_ROOT()` — —
- `main()` — —
- `probe()` — —
- `timeoutMs()` — —
- `models()` — —
- `root()` — —
- `config()` — —
- `result()` — —
- `comparison()` — —
- `rendered()` — —
- `jsonTarget()` — —
- `markdownTarget()` — —
- `failedAudit()` — —
- `message()` — —
- `writeFile()` — —
- `root()` — —
- `output()` — —
- `latestPath()` — —
- `latest()` — —
- `manifestPath()` — —
- `manifest()` — —
- `stage()` — —
- `tokens()` — —
- `cost()` — —
- `sourceRoot()` — —
- `files()` — —
- `graph()` — —
- `body()` — —
- `target()` — —
- `relative()` — —
- `targetRelative()` — —
- `visiting()` — —
- `visited()` — —
- `visit()` — —
- `start()` — —
- `collect()` — —
- `absolute()` — —
- `resolveSource()` — —
- `raw()` — —
- `slash()` — —
- `REPO_ROOT()` — —
- `envNumber()` — —
- `value()` — —
- `main()` — —
- `config()` — —
- `manifest()` — —
- `history()` — —
- `recorded()` — —
- `runLivePipeline()` — —
- `root()` — —
- `outputDir()` — —
- `deadline()` — —
- `deadlineTimer()` — —
- `startedAt()` — —
- `failed()` — —
- `runLivePipelineOnce()` — —
- `result()` — —
- `readLatestRunManifest()` — —
- `runsRoot()` — —
- `manifestPath()` — —
- `stat()` — —
- `auditPath()` — —
- `historyPath()` — —
- `readHistory()` — —
- `parsed()` — —
- `writeJson()` — —
- `options()` — —
- `entries()` — —
- `root()` — —
- `latest()` — —
- `runDirectory()` — —
- `diagnostics()` — —
- `graph()` — —
- `recordsById()` — —
- `findings()` — —
- `selected()` — —
- `trackedFiles()` — —
- `classification()` — —
- `labelCounts()` — —
- `labelRepositories()` — —
- `stratifiedSample()` — —
- `groups()` — —
- `values()` — —
- `added()` — —
- `record()` — —
- `targetClass()` — —
- `target()` — —
- `classify()` — —
- `text()` — —
- `file()` — —
- `exactFileUpdate()` — —
- `match()` — —
- `candidate()` — —
- `basename()` — —
- `pathOwners()` — —
- `countBy()` — —
- `item()` — —
- `readJson()` — —
- `parseArgs()` — —
- `value()` — —
- `index()` — —
- `limitIndex()` — —
- `limit()` — —
- `intentDirectoryIndex()` — —
- `intentDirectory()` — —
- `options()` — —
- `records()` — —
- `selectedRows()` — —
- `declaration()` — —
- `module()` — —
- `candidateSet()` — —
- `config()` — —
- `rerank()` — —
- `augmentedGraph()` — —
- `originalRelationIds()` — —
- `originallyRelatedPairs()` — —
- `candidateById()` — —
- `accepted()` — —
- `candidate()` — —
- `relation()` — —
- `verdictCounts()` — —
- `resolveDeclaration()` — —
- `exact()` — —
- `matches()` — —
- `resolveModule()` — —
- `readJson()` — —
- `parseArgs()` — —
- `values()` — —
- `key()` — —
- `value()` — —
- `required()` — —
- `top()` — —
- `ACTIONS()` — —
- `MODALITIES()` — —
- `POLARITIES()` — —
- `LIFECYCLES()` — —
- `SOURCE_KINDS()` — —
- `EPISTEMIC_CLASSES()` — —
- `RELATION_TYPES()` — —
- `CONCLUSION_KINDS()` — —
- `DIAGNOSTIC_SEVERITIES()` — —
- `TODO_PRIORITIES()` — —
- `GENERATION_REQUESTED_MODES()` — —
- `GENERATION_EFFECTIVE_MODES()` — —
- `CODE_CHANGE_ACTIONS()` — —
- `CODE_CHANGE_RISK_LEVELS()` — —
- `assertIntentRecord()` — —
- `record()` — —
- `statement()` — —
- `target()` — —
- `lifecycle()` — —
- `source()` — —
- `lines()` — —
- `epistemic()` — —
- `metadata()` — —
- `assertGenerationMatchesExtractor()` — —
- `generation()` — —
- `separator()` — —
- `expectedGenerator()` — —
- `assertIntentGenerationMetadata()` — —
- `assertIntentRecords()` — —
- `assertIntentGraph()` — —
- `graph()` — —
- `recordIds()` — —
- `relationIds()` — —
- `stats()` — —
- `records()` — —
- `expectedFingerprint()` — —
- `assertIntentGraphDiff()` — —
- `diff()` — —
- `change()` — —
- `relations()` — —
- `summary()` — —
- `assertConclusion()` — —
- `known()` — —
- `assertConclusions()` — —
- `ids()` — —
- `id()` — —
- `assertTodoProposal()` — —
- `assertTodoProposals()` — —
- `proposalIds()` — —
- `assertCodeChangePlan()` — —
- `assertCodeChangePlans()` — —
- `assertCodeChangePlansForReview()` — —
- `plan()` — —
- `evidence()` — —
- `assertCodeChangePlanForAcceptance()` — —
- `assertPlanGraphFingerprint()` — —
- `assertCodeChangeAcceptance()` — —
- `beforeKnown()` — —
- `afterKnown()` — —
- `acceptance()` — —
- `expectedCleared()` — —
- `expectedRemaining()` — —
- `expectedBlocking()` — —
- `expectedAccepted()` — —
- `assertConclusionValue()` — —
- `conclusion()` — —
- `expectedId()` — —
- `assertTodoProposalValue()` — —
- `proposal()` — —
- `assertGroundedGenerationMetadata()` — —
- `validateGroundedContext()` — —
- `report()` — —
- `diagnosticIds()` — —
- `diagnostic()` — —
- `validateTodoProposalContext()` — —
- `validateCodeChangePlanContext()` — —
- `conclusions()` — —
- `proposals()` — —
- `referencedConclusionIds()` — —
- `assertCodeChangePlanValue()` — —
- `targetPaths()` — —
- `changePaths()` — —
- `normalizedPath()` — —
- `risk()` — —
- `semantic()` — —
- `expectedHash()` — —
- `assertRelation()` — —
- `relation()` — —
- `objectValue()` — —
- `exactKeys()` — —
- `expectedSet()` — —
- `missing()` — —
- `extra()` — —
- `nonEmptyString()` — —
- `nonBlankString()` — —
- `nullableString()` — —
- `enumValue()` — —
- `stringArray()` — —
- `nonEmptyUniqueStringArray()` — —
- `repositoryPath()` — —
- `normalized()` — —
- `exactStringSet()` — —
- `uniqueIdArray()` — —
- `nonEmptyUniqueIdArray()` — —
- `knownReferences()` — —
- `unknown()` — —
- `confidence()` — —
- `assertAcyclicProposalDependencies()` — —
- `byId()` — —
- `visiting()` — —
- `visited()` — —
- `visit()` — —
- `start()` — —
- `dateString()` — —
- `nullableDate()` — —
- `fingerprint()` — —
- `nonNegativeInteger()` — —
- `countMap()` — —
- `map()` — —
- `countRecords()` — —
- `key()` — —
- `exactCounts()` — —
- `actual()` — —
- `isJsonValue()` — —
- `argumentValue()` — —
- `normalizedToken()` — —
- `significant()` — —
- `qualifiedName()` — —
- `sourceExcerpt()` — —
- `addFact()` — —
- `parseFile()` — —
- `validateContract()` — —
- `executeContract()` — —
- `client()` — —
- `main()` — —
- `emit()` — —
- `collectGoFiles()` — —
- `parseFile()` — —
- `position()` — —
- `excerpt()` — —
- `add()` — —
- `visitDecl()` — —
- `visitFunc()` — —
- `visitGenDecl()` — —
- `visitCalls()` — —
- `typeName()` — —
- `declaredTypeKind()` — —
- `strPtr()` — —
- `toSlash()` — —
- `classifyEvent()` — —
- `toRows()` — —
- `renderTable()` — —
- `table()` — —
- `head()` — —
- `body()` — —
- `tr()` — —
- `cell()` — —
- `renderError()` — —
- `banner()` — —
- `headerRow()` — —
- `th()` — —
- `createState()` — —
- `refresh()` — —
- `page()` — —
- `message()` — —
- `mountPanel()` — —
- `state()` — —
- `reload()` — —
- `ALLOWED_ACTIONS()` — —
- `validateEventPayload()` — —
- `invalid()` — —
- `record()` — —
- `agent()` — —
- `action()` — —
- `object()` — —
- `MAX_BODY_BYTES()` — —
- `createBackend()` — —
- `store()` — —
- `server()` — —
- `handleRequest()` — —
- `url()` — —
- `body()` — —
- `validation()` — —
- `event()` — —
- `offset()` — —
- `limit()` — —
- `readBody()` — —
- `size()` — —
- `buffer()` — —
- `sendJson()` — —
- `startBackend()` — —
- `port()` — —
- `host()` — —
- `parse_args()` — —
- `main()` — —
- `detect_file_language_with_parser_id(file_path)` — Expose the lowercase tree-sitter ID through the legacy `.name` field.
- `parse_args()` — —
- `projection_text(record, prefix)` — —
- `main()` — —
- `load_task(path)` — —
- `normalize_task(value)` — —
- `main()` — —
- `main()` — —
- `source_hash(value)` — —
- `dotted_name(node)` — —
- `is_module_entrypoint(node)` — Return true for the canonical ``if __name__ == '__main__'`` guard.
- `iter_python_files(root, files_from)` — —
- `main()` — —


## Project Structure

📄 `CHANGELOG`
📄 `CONTRIBUTION`
📄 `Dockerfile`
📄 `Makefile`
📄 `README`
📄 `TASK`
📄 `TODO`
📄 `adapters.tensorflow.package`
📄 `compose.e2e`
📄 `docker-compose`
📄 `docs.ARCHITECTURE`
📄 `docs.CLI_GUIDE`
📄 `docs.CODE_CHANGE_PLANS`
📄 `docs.DEMOLLM`
📄 `docs.DSL`
📄 `docs.E2E`
📄 `docs.GROK-PLAN`
📄 `docs.OPTIMIZATION`
📄 `docs.PIPELINE_DSL_NL`
📄 `docs.PROJECT_STATUS`
📄 `docs.PROTOCOLS`
📄 `docs.READINESS`
📄 `docs.REQUIREMENTS`
📄 `docs.SECURITY`
📄 `docs.SUBACTOR_OPERATION_DSL`
📄 `docs.SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW`
📄 `docs.TEAM_COMMUNICATION`
📄 `docs.TEST_REPORT`
📄 `docs.VALIDATION`
📄 `docs.intent-guard-diagrams.ALL_DIAGRAMS`
📄 `docs.intent-guard-diagrams.README`
📄 `docs.reference.original-monitoring-design`
📄 `evaluation.gold.README`
📄 `evaluation.gold.v1.dataset`
📄 `evaluation.gold.v2.dataset`
📄 `examples.CHANGELOG`
📄 `examples.TODO`
📄 `examples.backend.CHANGELOG`
📄 `examples.backend.README`
📄 `examples.backend.TODO`
📄 `examples.backend.src.server` (19 functions, 1 classes)
📄 `examples.backend.src.store` (4 functions, 3 classes)
📄 `examples.backend.src.validation` (7 functions, 1 classes)
📄 `examples.backend.task`
📄 `examples.backend.tsconfig`
📄 `examples.docs.ARCHITECTURE`
📄 `examples.frontend.CHANGELOG`
📄 `examples.frontend.README`
📄 `examples.frontend.TODO`
📄 `examples.frontend.src.api` (8 functions, 3 classes)
📄 `examples.frontend.src.app` (7 functions, 1 classes)
📄 `examples.frontend.src.render` (13 functions, 1 classes)
📄 `examples.frontend.task`
📄 `examples.frontend.tsconfig`
📄 `examples.project.DEMO-101.agent.codex.plan.001`
📄 `examples.project.DEMO-101.agent.codex.report.002`
📄 `examples.project.DEMO-101.agent.rogue.plan.001`
📄 `examples.project.DEMO-101.human.product-owner.request.001`
📄 `examples.project.DEMO-101.human.security.decision.001`
📄 `examples.project.participants`
📄 `examples.sdk.python`
📄 `examples.sdk.typescript` (1 functions)
📄 `examples.src.helper` (2 functions)
📄 `examples.src.runtime` (2 functions, 1 classes)
📄 `examples.task`
📄 `golang.ast_extract` (15 functions, 3 classes)
📄 `java.JavaAstExtract` (25 functions, 1 classes)
📄 `package`
📄 `php.ast_extract` (7 functions)
📄 `project` (3 functions)
📄 `project.ticket-001.AI-Codex`
📄 `project.ticket-001.README`
📄 `project.ticket-001.logs`
📄 `project.ticket-002.README`
📄 `project.ticket-002.ai-codex`
📄 `project.ticket-002.ai-codex-logs`
📄 `project.ticket-002.baseline`
📄 `project.ticket-002.changelog`
📄 `project.ticket-002.iteration-01`
📄 `project.ticket-002.iteration-02`
📄 `project.ticket-002.preprompt`
📄 `project.ticket-002.user-tom-sapletta-com`
📄 `project.ticket-003.README`
📄 `project.ticket-003.ai-codex`
📄 `project.ticket-003.ai-codex-logs`
📄 `project.ticket-003.audit`
📄 `project.ticket-003.changelog`
📄 `project.ticket-003.iteration-01`
📄 `project.ticket-003.preprompt`
📄 `project.ticket-003.sample`
📄 `project.ticket-003.user-tom-sapletta-com`
📄 `project.ticket-004.README`
📄 `project.ticket-004.ai-codex`
📄 `project.ticket-004.ai-codex-logs`
📄 `project.ticket-004.audit`
📄 `project.ticket-004.benchmark`
📄 `project.ticket-004.changelog`
📄 `project.ticket-004.e5-prefixed-results`
📄 `project.ticket-004.e5-results`
📄 `project.ticket-004.iteration-01`
📄 `project.ticket-004.minilm-results`
📄 `project.ticket-004.platform-e5-ranking`
📄 `project.ticket-004.platform-e5-reciprocal-ranking`
📄 `project.ticket-004.preprompt`
📄 `project.ticket-004.user-tom-sapletta-com`
📄 `project.ticket-005.README`
📄 `project.ticket-005.ai-codex`
📄 `project.ticket-005.ai-codex-logs`
📄 `project.ticket-005.audit`
📄 `project.ticket-005.changelog`
📄 `project.ticket-005.preprompt`
📄 `project.ticket-005.user-tom-sapletta-com`
📄 `project.ticket-006.README`
📄 `project.ticket-006.ai-codex`
📄 `project.ticket-006.ai-codex-logs`
📄 `project.ticket-006.audit`
📄 `project.ticket-006.changelog`
📄 `project.ticket-006.preprompt`
📄 `project.ticket-007.README`
📄 `project.ticket-007.ai-codex`
📄 `project.ticket-007.ai-codex-logs`
📄 `project.ticket-007.audit`
📄 `project.ticket-007.changelog`
📄 `project.ticket-007.preprompt`
📄 `project.ticket-008.README`
📄 `project.ticket-008.ai-codex`
📄 `project.ticket-008.ai-codex-logs`
📄 `project.ticket-008.audit`
📄 `project.ticket-008.changelog`
📄 `project.ticket-008.preprompt`
📄 `project.ticket-009.README`
📄 `project.ticket-009.ai-codex`
📄 `project.ticket-009.ai-codex-logs`
📄 `project.ticket-009.audit`
📄 `project.ticket-009.changelog`
📄 `project.ticket-009.preprompt`
📄 `project.ticket-010.README`
📄 `project.ticket-010.ai-codex`
📄 `project.ticket-010.ai-codex-logs`
📄 `project.ticket-010.audit`
📄 `project.ticket-010.changelog`
📄 `project.ticket-010.preprompt`
📄 `project.ticket-011.README`
📄 `project.ticket-011.ai-codex`
📄 `project.ticket-011.ai-codex-logs`
📄 `project.ticket-011.audit`
📄 `project.ticket-011.changelog`
📄 `project.ticket-011.preprompt`
📄 `project.ticket-012.README`
📄 `project.ticket-012.ai-codex`
📄 `project.ticket-012.ai-codex-logs`
📄 `project.ticket-012.audit`
📄 `project.ticket-012.changelog`
📄 `project.ticket-012.preprompt`
📄 `project.ticket-013.README`
📄 `project.ticket-013.ai-codex`
📄 `project.ticket-013.ai-codex-logs`
📄 `project.ticket-013.audit`
📄 `project.ticket-013.changelog`
📄 `project.ticket-013.preprompt`
📄 `project.ticket-014.README`
📄 `project.ticket-014.ai-codex`
📄 `project.ticket-014.ai-codex-logs`
📄 `project.ticket-014.audit`
📄 `project.ticket-014.changelog`
📄 `project.ticket-014.preprompt`
📄 `project.ticket-015.README`
📄 `project.ticket-015.ai-codex`
📄 `project.ticket-015.ai-codex-logs`
📄 `project.ticket-015.audit`
📄 `project.ticket-015.changelog`
📄 `project.ticket-015.preprompt`
📄 `project.ticket-016.README`
📄 `project.ticket-016.ai-codex`
📄 `project.ticket-016.ai-codex-logs`
📄 `project.ticket-016.audit`
📄 `project.ticket-016.changelog`
📄 `project.ticket-016.preprompt`
📄 `project.ticket-017.README`
📄 `project.ticket-017.ai-codex`
📄 `project.ticket-017.ai-codex-logs`
📄 `project.ticket-017.changelog`
📄 `project.ticket-017.preprompt`
📄 `prompts.communication-to-intent.system`
📄 `prompts.docs-to-intent.system`
📄 `prompts.markdown-to-intent.system`
📄 `prompts.nl-to-intent.system`
📄 `prompts.summarize.system`
📄 `prompts.tasks-from-dsl.system`
📄 `python.ast_extract` (18 functions, 1 classes)
📄 `python.requirements`
📄 `rust-ast.Cargo`
📄 `rust-ast.src.main` (23 functions, 3 classes)
📄 `schemas.code-change-acceptance.schema`
📄 `schemas.code-change-close-result.schema`
📄 `schemas.code-change-plan-set.schema`
📄 `schemas.code-change-plan.schema`
📄 `schemas.code-change-review.schema`
📄 `schemas.code-change-source-apply-receipt.schema`
📄 `schemas.code-change-source-patch-set.schema`
📄 `schemas.code-change-source-patch.schema`
📄 `schemas.conclusion.schema`
📄 `schemas.document-extraction-response.schema`
📄 `schemas.gold-dataset.schema`
📄 `schemas.intent-graph-diff.schema`
📄 `schemas.intent-graph.schema`
📄 `schemas.intent-record.schema`
📄 `schemas.operation-plan.schema`
📄 `schemas.participant-registry.schema`
📄 `schemas.participant-synthesis.schema`
📄 `schemas.semantic-candidate-set.schema`
📄 `schemas.semantic-rerank.schema`
📄 `schemas.todo-patch.schema`
📄 `schemas.todo-proposal.schema`
📄 `schemas.variable-contract.schema`
📄 `scripts.a2a-request`
📄 `scripts.assert-demollm-run` (10 functions)
📄 `scripts.docker-smoke` (1 functions)
📄 `scripts.e2e` (3 functions)
📄 `scripts.examples-check` (3 functions)
📄 `scripts.generate-response-schemas` (4 functions)
📄 `scripts.live-contract-check` (27 functions)
📄 `scripts.live-model-comparison` (15 functions)
📄 `scripts.mcp-request`
📄 `scripts.normalize-generated-analysis-roots` (7 functions)
📄 `scripts.package`
📄 `scripts.research.README`
📄 `scripts.research.audit-changelog-sample` (40 functions)
📄 `scripts.research.evaluate-embedding-pairs` (2 functions)
📄 `scripts.research.rank-intent-graph-embeddings` (3 functions)
📄 `scripts.research.rerank-embedding-shortlist` (30 functions)
📄 `scripts.smoke`
📄 `scripts.sync-generated-readme-metadata` (14 functions)
📄 `scripts.vallm-compatible` (1 functions)
📄 `scripts.verify-env-contract` (18 functions)
📄 `scripts.verify-generated-analysis` (15 functions)
📄 `scripts.verify-module-boundaries` (17 functions)
📄 `scripts.verify-no-llm-imports` (6 functions)
📄 `scripts.verify-structured-responses` (7 functions)
📄 `scripts.verify-workflow-yaml` (9 functions)
📦 `sdk`
📄 `sdk.README`
📄 `sdk.go.README`
📄 `sdk.go.actions` (18 functions)
📄 `sdk.go.client` (10 functions, 3 classes)
📄 `sdk.go.examples.basic.main` (5 functions)
📄 `sdk.go.todo2code`
📄 `sdk.go.types` (2 functions, 19 classes)
📄 `sdk.php.README`
📄 `sdk.php.composer`
📄 `sdk.php.examples.basic`
📄 `sdk.php.src.Client` (27 functions, 1 classes)
📄 `sdk.php.src.Error` (2 functions, 1 classes)
📦 `sdk.python`
📄 `sdk.python.README`
📄 `sdk.python.examples.basic` (1 functions)
📄 `sdk.python.examples.local_runtime` (1 functions)
📄 `sdk.python.pyproject`
📦 `sdk.python.todo2code`
📄 `sdk.python.todo2code.client` (45 functions, 7 classes)
📄 `sdk.python.todo2code.runtime` (10 functions, 3 classes)
📄 `sdk.python.todo2code_sdk` (11 functions, 1 classes)
📄 `sdk.rust.Cargo`
📄 `sdk.rust.README`
📄 `sdk.rust.examples.basic` (3 functions)
📄 `sdk.rust.src`
📄 `sdk.rust.src.actions` (20 functions)
📄 `sdk.rust.src.client` (19 functions, 1 classes)
📄 `sdk.rust.src.error` (3 functions)
📄 `sdk.rust.src.types` (1 functions, 11 classes)
📄 `sdk.typescript.README`
📄 `sdk.typescript.examples.basic` (19 functions)
📄 `sdk.typescript.package`
📦 `sdk.typescript.src` (48 functions, 14 classes)
📄 `sdk.typescript.tsconfig`
📦 `src`
📄 `src.cli` (152 functions, 1 classes)
📄 `src.communication.analyzer` (79 functions, 3 classes)
📄 `src.communication.identity` (14 functions, 3 classes)
📄 `src.communication.llm` (55 functions, 8 classes)
📄 `src.comparison.workspace` (55 functions, 3 classes)
📄 `src.config.env` (26 functions, 1 classes)
📄 `src.core.content-cache` (13 functions, 4 classes)
📄 `src.core.grounding` (5 functions)
📄 `src.core.id` (16 functions)
📄 `src.core.ignore` (24 functions, 3 classes)
📄 `src.core.io` (36 functions, 1 classes)
📄 `src.core.record` (9 functions, 2 classes)
📄 `src.core.schema` (151 functions, 4 classes)
📄 `src.core.security` (11 functions)
📄 `src.core.target` (13 functions)
📄 `src.core.text` (56 functions)
📄 `src.core.types` (41 classes)
📄 `src.core.version`
📄 `src.diff.git` (21 functions, 3 classes)
📄 `src.diff.reality` (77 functions, 3 classes)
📄 `src.diff.svg` (7 functions, 2 classes)
📄 `src.diff.text` (53 functions, 1 classes)
📄 `src.diff.text-render` (35 functions, 2 classes)
📄 `src.diff.text-types` (4 classes)
📄 `src.evaluation.gold` (37 functions, 3 classes)
📄 `src.evaluation.gold-cases` (57 functions, 4 classes)
📄 `src.evaluation.gold-cli` (10 functions)
📄 `src.evaluation.gold-extraction` (14 functions)
📄 `src.evaluation.gold-metrics` (12 functions, 1 classes)
📄 `src.evaluation.gold-types` (11 functions, 15 classes)
📄 `src.extractors.ast` (17 functions, 2 classes)
📄 `src.extractors.ast.external` (5 functions, 1 classes)
📄 `src.extractors.ast.go` (2 functions)
📄 `src.extractors.ast.java` (2 functions)
📄 `src.extractors.ast.php` (6 functions)
📄 `src.extractors.ast.python` (6 functions)
📄 `src.extractors.ast.records` (10 functions)
📄 `src.extractors.ast.rust` (2 functions)
📄 `src.extractors.ast.types` (2 classes)
📄 `src.extractors.ast.typescript` (21 functions)
📄 `src.extractors.ast.unsupported` (4 functions)
📄 `src.extractors.changelog` (16 functions)
📄 `src.extractors.communication` (75 functions, 4 classes)
📄 `src.extractors.configuration` (40 functions, 1 classes)
📄 `src.extractors.docs-chunks` (29 functions)
📄 `src.extractors.docs-deterministic` (35 functions, 1 classes)
📄 `src.extractors.docs-llm` (29 functions, 1 classes)
📄 `src.extractors.docs-record` (36 functions)
📄 `src.extractors.docs-schema` (5 functions)
📄 `src.extractors.docs-types` (7 classes)
📄 `src.extractors.git` (29 functions, 3 classes)
📄 `src.extractors.markdown` (4 functions, 1 classes)
📄 `src.extractors.markdown-block` (3 functions, 1 classes)
📄 `src.extractors.markdown-llm` (38 functions, 6 classes)
📄 `src.extractors.markdown-paths` (19 functions, 1 classes)
📄 `src.extractors.nl` (12 functions, 1 classes)
📄 `src.extractors.nl-llm` (45 functions, 5 classes)
📄 `src.extractors.todo` (18 functions)
📄 `src.graph.capability-evidence` (14 functions)
📄 `src.graph.changelog-signal` (13 functions)
📄 `src.graph.diagnostics` (42 functions)
📄 `src.graph.diff` (38 functions, 1 classes)
📄 `src.graph.linker` (75 functions, 4 classes)
📄 `src.graph.symbol-resolution` (16 functions, 3 classes)
📄 `src.interfaces.a2a` (46 functions)
📄 `src.interfaces.a2a-card` (7 functions)
📄 `src.interfaces.a2a-history` (38 functions, 3 classes)
📄 `src.interfaces.a2a-message` (35 functions)
📄 `src.interfaces.a2a-task-store` (92 functions, 3 classes)
📄 `src.interfaces.a2a-types` (14 functions, 9 classes)
📄 `src.interfaces.mcp` (43 functions, 2 classes)
📄 `src.interfaces.mcp-errors` (2 functions, 1 classes)
📄 `src.interfaces.mcp-resources` (13 functions)
📄 `src.interfaces.mcp-tools` (10 functions, 1 classes)
📄 `src.live.contract-check` (39 functions, 6 classes)
📄 `src.live.model-comparison` (21 functions, 4 classes)
📄 `src.llm.audit` (1 functions)
📄 `src.llm.failure` (3 functions, 1 classes)
📄 `src.llm.openrouter` (49 functions, 7 classes)
📄 `src.llm.structured-schema` (37 functions, 5 classes)
📄 `src.operations.artifact` (10 functions, 2 classes)
📄 `src.operations.compile-cli` (7 functions)
📄 `src.operations.contract` (8 functions)
📄 `src.operations.subactor` (10 functions, 1 classes)
📄 `src.operations.types` (8 classes)
📄 `src.operations.validation` (47 functions)
📄 `src.pipeline.run` (64 functions, 1 classes)
📄 `src.sdk.typescript` (16 functions, 6 classes)
📄 `src.semantic.reranker` (40 functions, 11 classes)
📄 `src.semantic.reranker-llm` (29 functions, 2 classes)
📄 `src.semantic.reranker-response` (5 functions, 1 classes)
📄 `src.services.actions` (113 functions)
📄 `src.summary.payload` (8 functions)
📄 `src.summary.render` (14 functions)
📄 `src.summary.summarizer` (33 functions, 5 classes)
📄 `src.synthesis.code-change-path` (14 functions)
📄 `src.synthesis.code-change-plan` (148 functions, 10 classes)
📄 `src.synthesis.task-synthesis-contract` (6 functions, 3 classes)
📄 `src.synthesis.task-synthesis-materialize` (37 functions)
📄 `src.synthesis.task-synthesis-payload` (8 functions)
📄 `src.synthesis.tasks-llm` (22 functions, 4 classes)
📄 `src.synthesis.todo-patch` (53 functions, 5 classes)
📄 `src.synthesis.validation` (29 functions, 2 classes)
📄 `src.tf.classifier` (27 functions, 4 classes)
📄 `src.version`
📄 `src.watch.watcher` (38 functions, 4 classes)
📄 `src.web.diff-ui` (9 functions)
📄 `tsconfig`

## Requirements

- typescript >=5.8.3 <7

## Contributing

**Contributors:**
- Tom Softreck <tom@sapletta.com>
- Mateusz Lewandowski <matlew2003@gmail.com>

We welcome contributions! Open an issue or pull request to get started.
### Development Setup

```bash
# Clone the repository
git clone https://github.com/semcod/todo2code
cd todo2code

# Install dependencies
npm install

# Run tests
npm test
```

## Documentation

- 💡 [Examples](./examples) — Usage examples and code samples

### Generated Files

| Output | Description | Link |
|--------|-------------|------|
| `README.md` | Project overview (this file) | — |
| `examples` | Usage examples and code samples | [View](./examples) |

<!-- code2docs:end -->