<!-- code2docs:start --># todo2code

![version](https://img.shields.io/badge/version-0.5.0-blue) ![node](https://img.shields.io/badge/node-%3E%3D20-339933) ![coverage](https://img.shields.io/badge/coverage-unknown-lightgrey) ![functions](https://img.shields.io/badge/functions-2843-green)
> **2843** functions | **299** classes | **251** files | CC̄ = 4.0

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
├── package
├── TODO
├── project
├── TASK
├── Makefile
├── README
├── Dockerfile
├── CONTRIBUTION
├── CHANGELOG
├── docker-compose
    ├── version
├── src/
        ├── classifier
        ├── validation
        ├── types
        ├── diff-ui
        ├── payload
        ├── render
        ├── watcher
        ├── subactor
        ├── contract
        ├── failure
        ├── typescript
        ├── audit
        ├── mcp-errors
        ├── summarizer
        ├── artifact
        ├── code-change-path
        ├── compile-cli
        ├── mcp-tools
        ├── a2a-types
        ├── mcp-resources
        ├── a2a-card
        ├── tasks-llm
        ├── mcp
        ├── todo-patch
        ├── a2a
        ├── todo
        ├── nl
        ├── a2a-message
        ├── markdown-block
        ├── markdown
        ├── docs-types
        ├── diagnostics
        ├── docs-schema
    ├── cli
        ├── linker
        ├── docs-llm
        ├── git
        ├── a2a-history
        ├── openrouter
        ├── docs-chunks
        ├── markdown-llm
        ├── validation
        ├── diff
        ├── ast
        ├── docs-record
        ├── changelog
            ├── types
            ├── java
            ├── rust
        ├── configuration
            ├── typescript
            ├── external
            ├── unsupported
        ├── a2a-task-store
            ├── python
        ├── gold-metrics
            ├── go
        ├── docs-deterministic
        ├── communication
        ├── text-types
        ├── version
        ├── svg
        ├── gold-cli
        ├── nl-llm
        ├── gold-types
            ├── records
        ├── gold-extraction
        ├── security
        ├── code-change-plan
        ├── actions
        ├── git
        ├── types
        ├── id
        ├── text-render
        ├── target
        ├── record
        ├── grounding
    ├── README
        ├── tsconfig
        ├── identity
        ├── README
        ├── env
        ├── package
        ├── gold-cases
        ├── Cargo
        ├── gold
        ├── README
            ├── error
        ├── ignore
        ├── run
            ├── basic
            ├── types
        ├── pyproject
        ├── llm
        ├── io
        ├── src
        ├── README
        ├── text
        ├── text
            ├── client
            ├── actions
            ├── basic
        ├── composer
        ├── README
            ├── Error
        ├── src/
            ├── basic
        ├── workspace
        ├── todo2code
        ├── README
                ├── main
        ├── types
    ├── verify-workflow-yaml
    ├── verify-module-boundaries
    ├── verify-no-llm-imports
        ├── actions
        ├── client
    ├── verify-generated-analysis
    ├── smoke
    ├── sync-generated-readme-metadata
        ├── analyzer
    ├── normalize-generated-analysis-roots
    ├── mcp-request
            ├── Client
    ├── examples-check
    ├── docker-smoke
    ├── verify-env-contract
        ├── schema
        ├── schema
        ├── schema
    ├── live-contract-check
    ├── a2a-request
        ├── schema
        ├── schema
        ├── schema
        ├── schema
    ├── assert-demollm-run
        ├── reality
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
    ├── Cargo
    ├── requirements
        ├── system
        ├── system
        ├── schema
        ├── schema
        ├── system
        ├── system
        ├── system
        ├── user-tom-sapletta-com
        ├── preprompt
        ├── system
        ├── schema
        ├── changelog
        ├── logs
        ├── README
        ├── AI-Codex
        ├── ai-codex-logs
        ├── ai-codex
        ├── README
    ├── task
    ├── TODO
    ├── CHANGELOG
        ├── runtime
    ├── JavaAstExtract
        ├── typescript
        ├── participants
                        ├── 001
        ├── main
                        ├── 001
                        ├── 002
                        ├── 001
        ├── tsconfig
                        ├── 001
        ├── TODO
    ├── ast_extract
        ├── task
        ├── CHANGELOG
        ├── README
            ├── render
        ├── ARCHITECTURE
        ├── tsconfig
        ├── task
            ├── app
        ├── README
        ├── CHANGELOG
            ├── api
            ├── store
        ├── TODO
        ├── README
            ├── validation
            ├── dataset
            ├── dataset
    ├── TEST_REPORT
    ├── TEAM_COMMUNICATION
    ├── SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW
    ├── VALIDATION
    ├── SECURITY
    ├── SUBACTOR_OPERATION_DSL
    ├── READINESS
    ├── PROTOCOLS
    ├── REQUIREMENTS
    ├── PIPELINE_DSL_NL
    ├── OPTIMIZATION
    ├── PROJECT_STATUS
    ├── DSL
    ├── DEMOLLM
            ├── server
    ├── CLI_GUIDE
    ├── ARCHITECTURE
        ├── original-monitoring-design
    ├── GROK-PLAN
        ├── README
        ├── package
    ├── CODE_CHANGE_PLANS
        ├── ALL_DIAGRAMS
        ├── todo2code/
    ├── python/
├── sdk/
            ├── runtime
        ├── todo2code_sdk
    ├── vallm-compatible
    ├── package
            ├── basic
        ├── helper
        ├── python
            ├── local_runtime
    ├── ast_extract
            ├── client
```

## API Overview

### Classes

- **`TfTensor`** — —
- **`TfModel`** — —
- **`TfModule`** — —
- **`ModelAssets`** — —
- **`TodoProposalDuplicate`** — —
- **`TodoProposalValidationResult`** — —
- **`VariableContract`** — —
- **`OperationParameterReference`** — —
- **`OperationRollback`** — —
- **`OperationStep`** — —
- **`OperationExpectation`** — —
- **`OperationPlan`** — —
- **`ResolvedVariableBinding`** — —
- **`SubactorProcessEnvelope`** — —
- **`SnapshotDelta`** — —
- **`ScanOptions`** — —
- **`ReportResult`** — —
- **`WatchOptions`** — —
- **`CompileSubactorEnvelopeOptions`** — —
- **`LlmFailureReason`** — —
- **`Todo2CodeClientOptions`** — —
- **`DiffResult`** — —
- **`FileDiffResult`** — —
- **`GitDiffResponse`** — —
- **`RealityResult`** — —
- **`Todo2CodeClient`** — —
- **`McpRequestError`** — —
- **`SummaryResult`** — —
- **`SummaryOptions`** — —
- **`RawConclusion`** — —
- **`RawSummaryResponse`** — —
- **`SummaryAttemptError`** — —
- **`CompileOperationPlanArtifactOptions`** — —
- **`OperationPlanCompilationReceipt`** — —
- **`McpTool`** — —
- **`JsonRpcRequest`** — —
- **`A2APart`** — —
- **`A2AMessage`** — —
- **`A2AArtifact`** — —
- **`A2ATask`** — —
- **`StoredTask`** — —
- **`SendConfiguration`** — —
- **`A2ARequestError`** — —
- **`BodyTooLargeError`** — —
- **`RawDiagnosticAction`** — —
- **`AuditedTaskSynthesisResult`** — —
- **`TaskSynthesisRequiredError`** — —
- **`TaskSynthesisAttemptError`** — —
- **`RawConclusion`** — —
- **`RawProposal`** — —
- **`RawTaskSynthesisResponse`** — —
- **`JsonRpcRequest`** — —
- **`McpConnectionState`** — —
- **`CreateTodoPatchOptions`** — —
- **`CreatedTodoPatch`** — —
- **`WriteTodoPatchOptions`** — —
- **`WrittenTodoPatch`** — —
- **`ApplyTodoPatchOptions`** — —
- **`NlExtractionOptions`** — —
- **`MarkdownListBlock`** — —
- **`MarkdownExtractionOptions`** — —
- **`RawDocumentRecord`** — —
- **`DocumentResponse`** — —
- **`DocumentChunk`** — —
- **`DocumentationTargetHints`** — —
- **`DocumentationExtractionOptions`** — —
- **`DocumentationExtractionResult`** — —
- **`DocumentChunkResult`** — —
- **`ParsedArgs`** — —
- **`PairEvidence`** — —
- **`RecordKeywords`** — —
- **`DirectedRelation`** — —
- **`SourceRelationRule`** — —
- **`DocumentationLlmRequiredError`** — —
- **`GitCommit`** — —
- **`ChangedFile`** — —
- **`GitExtractionOptions`** — —
- **`IntentRunListItem`** — —
- **`CommunicationRunSummary`** — —
- **`RunHistoryFilters`** — —
- **`ChatMessage`** — —
- **`OpenRouterChoice`** — —
- **`OpenRouterResponse`** — —
- **`OpenRouterResult`** — —
- **`OpenRouterModelsResponse`** — —
- **`OpenRouterModelError`** — —
- **`OpenRouterClient`** — —
- **`MarkdownEnrichment`** — —
- **`MarkdownResponse`** — —
- **`AuditedMarkdownExtractionResult`** — —
- **`MarkdownLlmRequiredError`** — —
- **`DiffSvgOptions`** — —
- **`AstExtractionOptions`** — —
- **`AdapterFact`** — —
- **`AdapterOutput`** — —
- **`ConfigurationEntry`** — —
- **`ExternalAdapterOptions`** — —
- **`PreparedTask`** — —
- **`ListCursor`** — —
- **`TaskStoreSnapshot`** — —
- **`Counts`** — —
- **`DeterministicDocumentationOptions`** — —
- **`CommunicationExtractionOptions`** — —
- **`CommunicationEnvelope`** — —
- **`DiffLine`** — —
- **`DiffHunk`** — —
- **`FileDiff`** — —
- **`DiffTextOptions`** — —
- **`SvgTheme`** — —
- **`SvgDocumentOptions`** — —
- **`RawNlRecord`** — —
- **`NlResponse`** — —
- **`AuditedNlExtractionResult`** — —
- **`NlLlmRequiredError`** — —
- **`GoldRecordProjection`** — —
- **`GoldDocumentModelRecord`** — —
- **`GoldExtractionCase`** — —
- **`GoldFixtureRecord`** — —
- **`GoldExpectedRelation`** — —
- **`GoldLinkingCase`** — —
- **`GoldProposalFixture`** — —
- **`GoldDsl2TodoCase`** — —
- **`GoldExpectedDiagnostic`** — —
- **`GoldDiagnosticsCase`** — —
- **`GoldDataset`** — —
- **`BinaryMetric`** — —
- **`GoldEvaluationReport`** — —
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
- **`LlmResponseMetadata`** — —
- **`PipelineStageAudit`** — —
- **`PipelineOptions`** — —
- **`PipelineManifest`** — —
- **`TextDiffSvgOptions`** — —
- **`SideBySideRow`** — —
- **`BuildRecordGenerationInput`** — —
- **`BuildRecordInput`** — —
- **`ParticipantIdentityEntry`** — —
- **`ParticipantIdentityRegistry`** — —
- **`LoadedParticipantIdentityRegistry`** — —
- **`T2CConfig`** — —
- **`LinkingCaseResult`** — —
- **`DiagnosticsCaseResult`** — —
- **`Dsl2TodoCaseResult`** — —
- **`EvaluationCore`** — —
- **`EvaluationRun`** — —
- **`EvaluationResult`** — —
- **`IgnoreRule`** — —
- **`IgnoreMatcher`** — —
- **`LoadIgnoreOptions`** — —
- **`PipelineResult`** — —
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
- **`RawCommunicationEnrichment`** — —
- **`RawParticipantSynthesis`** — —
- **`RawCommunicationResponse`** — —
- **`ParticipantCommunicationSynthesis`** — —
- **`AuditedCommunicationExtractionResult`** — —
- **`CommunicationLlmRequiredError`** — —
- **`ParticipantGroup`** — —
- **`WalkOptions`** — —
- **`RawOp`** — —
- **`Client`** — —
- **`Error`** — —
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
- **`Client`** — —
- **`rpcRequest`** — —
- **`rpcResponse`** — —
- **`CommunicationIssue`** — —
- **`ParticipantCommunicationAnalysis`** — —
- **`CommunicationAnalysis`** — —
- **`Client`** — —
- **`RealityRow`** — —
- **`IntentRealityView`** — —
- **`RealitySvgOptions`** — —
- **`GroundedValidationContext`** — —
- **`TodoProposalValidationContext`** — —
- **`CodeChangePlanValidationContext`** — —
- **`CodeChangeAcceptanceValidationContext`** — —
- **`Contract`** — —
- **`JavaAstExtract`** — —
- **`Fact`** — —
- **`Output`** — —
- **`Collector`** — —
- **`Fact`** — —
- **`output`** — —
- **`factCollector`** — —
- **`PanelRow`** — —
- **`PanelState`** — —
- **`IntentEvent`** — —
- **`EventPage`** — —
- **`ApiError`** — —
- **`IntentEvent`** — —
- **`EventPage`** — —
- **`EventStore`** — —
- **`ValidationResult`** — —
- **`BackendOptions`** — —
- **`TypeScriptRuntimeError`** — Raised when the local Node/TypeScript runtime cannot be executed.
- **`RuntimeResult`** — Raw result of a local TypeScript CLI invocation.
- **`TypeScriptRuntime`** — Execute the canonical TypeScript runtime from a Python process.
- **`Todo2CodeClient`** — Diff-focused client for the todo2code runtime.
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
- `diffUiHtml()` — —
- `byId()` — —
- `requestHeaders()` — —
- `formatBytes()` — —
- `selectedRun()` — —
- `updateMeta()` — —
- `fillSelect()` — —
- `loadRuns()` — —
- `compareGraphs()` — —
- `compactSummaryPayload()` — —
- `referenced()` — —
- `nonAst()` — —
- `moduleAst()` — —
- `relevantAst()` — —
- `ids()` — —
- `selectedRelations()` — —
- `compactRecord()` — —
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
- `valueMatchesType()` — —
- `assertBinding()` — —
- `ageSeconds()` — —
- `compileSubactorProcessEnvelope()` — —
- `variableById()` — —
- `referenced()` — —
- `variable()` — —
- `binding()` — —
- `humanApproval()` — —
- `variableContractSemanticValue()` — —
- `createVariableContract()` — —
- `normalized()` — —
- `normalizedPlanDraft()` — —
- `operationPlanHashMaterial()` — —
- `createOperationPlan()` — —
- `planHash()` — —
- `classifyLlmFailure()` — —
- `message()` — —
- `openRouterAuditConfiguration()` — —
- `summarizeGraph()` — —
- `mode()` — —
- `conclusions()` — —
- `client()` — —
- `systemPrompt()` — —
- `payload()` — —
- `failure()` — —
- `responses()` — —
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
- `argumentsByName()` — —
- `key()` — —
- `value()` — —
- `allowed()` — —
- `unknown()` — —
- `main()` — —
- `args()` — —
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
- `TERMINAL_TASK_STATES()` — —
- `TASK_STATES()` — —
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
- `sendAgentCard()` — —
- `card()` — —
- `serialized()` — —
- `payload()` — —
- `agentCard()` — —
- `skills()` — —
- `skill()` — —
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
- `inferOwner()` — —
- `match()` — —
- `extractExplicitId()` — —
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
- `readListBlock()` — —
- `cursor()` — —
- `line()` — —
- `extractMarkdownIntent()` — —
- `todo()` — —
- `changelog()` — —
- `diagnoseGraph()` — —
- `neighbors()` — —
- `recordsById()` — —
- `implementedPaths()` — —
- `documentedPaths()` — —
- `related()` — —
- `evidenced()` — —
- `missingFields()` — —
- `buildNeighbors()` — —
- `map()` — —
- `appendNeighbor()` — —
- `values()` — —
- `indexImplementedPaths()` — —
- `paths()` — —
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
- `indexKeywords()` — —
- `jaccard()` — —
- `intersection()` — —
- `linkIntentRecords()` — —
- `records()` — —
- `byId()` — —
- `keywordIndex()` — —
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
- `objectSimilarity()` — —
- `sharedTopics()` — —
- `intersectionSize()` — —
- `size()` — —
- `isFileAggregate()` — —
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
- `MARKDOWN_ACTION_SET()` — —
- `MARKDOWN_LLM_BATCH_RECORDS()` — —
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
- `extractAstIntent()` — —
- `root()` — —
- `matcher()` — —
- `files()` — —
- `body()` — —
- `result()` — —
- `unsupported()` — —
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
- `changelogAction()` — —
- `normalized()` — —
- `lower()` — —
- `extractJavaAst()` — —
- `helperPath()` — —
- `extractRustAst()` — —
- `helperPath()` — —
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
- `execFileAsync()` — —
- `runExternalAstAdapter()` — —
- `files()` — —
- `result()` — —
- `parsed()` — —
- `unsupportedSourceWarning()` — —
- `files()` — —
- `counts()` — —
- `extension()` — —
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
- `extractPythonAst()` — —
- `helperPath()` — —
- `matcher()` — —
- `files()` — —
- `temporaryDirectory()` — —
- `filesPath()` — —
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
- `extractGoAst()` — —
- `helperPath()` — —
- `MAX_HEADING_LEVEL()` — —
- `MIN_STATEMENT_CHARS()` — —
- `extractDocumentationBaseline()` — —
- `root()` — —
- `body()` — —
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
- `messageType()` — —
- `ticket()` — —
- `recipient()` — —
- `timestamp()` — —
- `declaredGitAuthors()` — —
- `gitAuthors()` — —
- `declaredA2aAgentId()` — —
- `explicitPaths()` — —
- `explicitSymbols()` — —
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
- `fileParts()` — —
- `nestedRoleIndex()` — —
- `nestedRole()` — —
- `nestedParticipant()` — —
- `looksLikeTicket()` — —
- `normalizeRole()` — —
- `normalizeType()` — —
- `normalized()` — —
- `isCommunicationType()` — —
- `semanticsFor()` — —
- `first()` — —
- `listValue()` — —
- `stripped()` — —
- `unquote()` — —
- `validTimestamp()` — —
- `parsed()` — —
- `escapeXml()` — —
- `truncate()` — —
- `sanitizeSourceLine()` — —
- `metricCard()` — —
- `svgStyles()` — —
- `svgDocument()` — —
- `theme()` — —
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
- `assertGoldDataset()` — —
- `dataset()` — —
- `assertDatasetObject()` — —
- `assertDatasetMetadata()` — —
- `assertDatasetCollections()` — —
- `assertUniqueCaseIds()` — —
- `assertExtractionCoverage()` — —
- `channels()` — —
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
- `rationale()` — —
- `titleFor()` — —
- `object()` — —
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
- `normalized()` — —
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
- `absolute()` — —
- `exists()` — —
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
- `buildRecord()` — —
- `rawExcerpt()` — —
- `withRecordGeneration()` — —
- `generationMetadata()` — —
- `used()` — —
- `extractorIdentity()` — —
- `separator()` — —
- `clamp()` — —
- `sourcePrefix()` — —
- `groundRecordIdsByDiagnostics()` — —
- `diagnosticById()` — —
- `allowed()` — —
- `suppliedGrounded()` — —
- `sortedUnique()` — —
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
- `evaluateLinkingCase()` — —
- `idToLabel()` — —
- `graph()` — —
- `observed()` — —
- `actual()` — —
- `expected()` — —
- `byClass()` — —
- `forbidden()` — —
- `forbiddenViolations()` — —
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
- `evaluateDsl2Todo()` — —
- `duplicateCounts()` — —
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
- `ACTION_SET()` — —
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
- `STOP_WORDS()` — —
- `classifyActionHeuristically()` — —
- `conventional()` — —
- `prose()` — —
- `searchable()` — —
- `detectModality()` — —
- `matches()` — —
- `detectPolarity()` — —
- `stripped()` — —
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
- `backticks()` — —
- `camel()` — —
- `ticketPrefixes()` — —
- `extractTickets()` — —
- `values()` — —
- `extractVersions()` — —
- `inferObject()` — —
- `normalized()` — —
- `result()` — —
- `splitIntentLines()` — —
- `lines()` — —
- `raw()` — —
- `cleaned()` — —
- `pieces()` — —
- `unwrapTask()` — —
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
- `main()` — —
- `run()` — —
- `envOr()` — —
- `truncate()` — —
- `joinedIDs()` — —
- `Generation()` — —
- `Error()` — —
- `explicit()` — —
- `files()` — —
- `body()` — —
- `seen()` — —
- `match()` — —
- `key()` — —
- `previous()` — —
- `workflowFiles()` — —
- `directory()` — —
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
- `visited()` — —
- `visit()` — —
- `body()` — —
- `resolved()` — —
- `resolveSource()` — —
- `raw()` — —
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
- `root()` — —
- `projectDirectory()` — —
- `textExtensions()` — —
- `untracked()` — —
- `relative()` — —
- `content()` — —
- `normalizePath()` — —
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
- `analyzeCommunication()` — —
- `communication()` — —
- `evidenceByRecord()` — —
- `participants()` — —
- `participant()` — —
- `values()` — —
- `left()` — —
- `right()` — —
- `code()` — —
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
- `withoutTickets()` — —
- `value()` — —
- `intersects()` — —
- `participantOf()` — —
- `roleOf()` — —
- `typeOf()` — —
- `ticketOf()` — —
- `gitAliases()` — —
- `normalizeIdentity()` — —
- `append()` — —
- `issue()` — —
- `severityRank()` — —
- `escapeCell()` — —
- `escapeRegex()` — —
- `root()` — —
- `sourceRoot()` — —
- `textExtensions()` — —
- `projectDirectory()` — —
- `changed()` — —
- `original()` — —
- `normalized()` — —
- `cleanup()` — —
- `record_sdk_log()` — —
- `run_sdk()` — —
- `cleanup()` — —
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
- `REPO_ROOT()` — —
- `envNumber()` — —
- `value()` — —
- `main()` — —
- `config()` — —
- `stages()` — —
- `audit()` — —
- `runStages()` — —
- `runDirectory()` — —
- `graph()` — —
- `diagnostics()` — —
- `nl()` — —
- `summary()` — —
- `latestDemoRun()` — —
- `runsRoot()` — —
- `latest()` — —
- `timeStage()` — —
- `startedAt()` — —
- `result()` — —
- `responses()` — —
- `redactedError()` — —
- `message()` — —
- `buildAudit()` — —
- `measured()` — —
- `usage()` — —
- `cost()` — —
- `totalTokens()` — —
- `overLatency()` — —
- `totalCostUsd()` — —
- `overCost()` — —
- `failures()` — —
- `sum()` — —
- `numbers()` — —
- `writeAudit()` — —
- `target()` — —
- `report()` — —
- `status()` — —
- `total()` — —
- `root()` — —
- `output()` — —
- `latestPath()` — —
- `latest()` — —
- `manifestPath()` — —
- `manifest()` — —
- `stage()` — —
- `tokens()` — —
- `cost()` — —
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
- `detect_file_language_with_parser_id(file_path)` — Expose the lowercase tree-sitter ID through the legacy `.name` field.
- `main()` — —
- `load_task(path)` — —
- `normalize_task(value)` — —
- `main()` — —
- `source_hash(value)` — —
- `dotted_name(node)` — —
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
📄 `docker-compose`
📄 `docs.ARCHITECTURE`
📄 `docs.CLI_GUIDE`
📄 `docs.CODE_CHANGE_PLANS`
📄 `docs.DEMOLLM`
📄 `docs.DSL`
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
📄 `project` (3 functions)
📄 `project.ticket-001.AI-Codex`
📄 `project.ticket-001.README`
📄 `project.ticket-001.logs`
📄 `project.ticket-002.README`
📄 `project.ticket-002.ai-codex`
📄 `project.ticket-002.ai-codex-logs`
📄 `project.ticket-002.changelog`
📄 `project.ticket-002.preprompt`
📄 `project.ticket-002.user-tom-sapletta-com`
📄 `prompts.communication-to-intent.system`
📄 `prompts.docs-to-intent.system`
📄 `prompts.markdown-to-intent.system`
📄 `prompts.nl-to-intent.system`
📄 `prompts.summarize.system`
📄 `prompts.tasks-from-dsl.system`
📄 `python.ast_extract` (13 functions, 1 classes)
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
📄 `schemas.todo-patch.schema`
📄 `schemas.todo-proposal.schema`
📄 `schemas.variable-contract.schema`
📄 `scripts.a2a-request`
📄 `scripts.assert-demollm-run` (10 functions)
📄 `scripts.docker-smoke` (1 functions)
📄 `scripts.examples-check` (3 functions)
📄 `scripts.live-contract-check` (39 functions)
📄 `scripts.mcp-request`
📄 `scripts.normalize-generated-analysis-roots` (7 functions)
📄 `scripts.package`
📄 `scripts.smoke`
📄 `scripts.sync-generated-readme-metadata` (14 functions)
📄 `scripts.vallm-compatible` (1 functions)
📄 `scripts.verify-env-contract` (18 functions)
📄 `scripts.verify-generated-analysis` (8 functions)
📄 `scripts.verify-module-boundaries` (17 functions)
📄 `scripts.verify-no-llm-imports` (6 functions)
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
📄 `src.communication.analyzer` (52 functions, 3 classes)
📄 `src.communication.identity` (14 functions, 3 classes)
📄 `src.communication.llm` (53 functions, 7 classes)
📄 `src.comparison.workspace` (55 functions, 3 classes)
📄 `src.config.env` (26 functions, 1 classes)
📄 `src.core.grounding` (5 functions)
📄 `src.core.id` (16 functions)
📄 `src.core.ignore` (24 functions, 3 classes)
📄 `src.core.io` (36 functions, 1 classes)
📄 `src.core.record` (9 functions, 2 classes)
📄 `src.core.schema` (151 functions, 4 classes)
📄 `src.core.security` (11 functions)
📄 `src.core.target` (13 functions)
📄 `src.core.text` (54 functions)
📄 `src.core.types` (39 classes)
📄 `src.core.version`
📄 `src.diff.git` (21 functions, 3 classes)
📄 `src.diff.reality` (76 functions, 3 classes)
📄 `src.diff.svg` (7 functions, 2 classes)
📄 `src.diff.text` (53 functions, 1 classes)
📄 `src.diff.text-render` (35 functions, 2 classes)
📄 `src.diff.text-types` (4 classes)
📄 `src.evaluation.gold` (36 functions, 3 classes)
📄 `src.evaluation.gold-cases` (41 functions, 3 classes)
📄 `src.evaluation.gold-cli` (10 functions)
📄 `src.evaluation.gold-extraction` (14 functions)
📄 `src.evaluation.gold-metrics` (12 functions, 1 classes)
📄 `src.evaluation.gold-types` (8 functions, 13 classes)
📄 `src.extractors.ast` (7 functions, 1 classes)
📄 `src.extractors.ast.external` (5 functions, 1 classes)
📄 `src.extractors.ast.go` (2 functions)
📄 `src.extractors.ast.java` (2 functions)
📄 `src.extractors.ast.python` (6 functions)
📄 `src.extractors.ast.records` (10 functions)
📄 `src.extractors.ast.rust` (2 functions)
📄 `src.extractors.ast.types` (2 classes)
📄 `src.extractors.ast.typescript` (21 functions)
📄 `src.extractors.ast.unsupported` (4 functions)
📄 `src.extractors.changelog` (15 functions)
📄 `src.extractors.communication` (57 functions, 2 classes)
📄 `src.extractors.configuration` (40 functions, 1 classes)
📄 `src.extractors.docs-chunks` (29 functions)
📄 `src.extractors.docs-deterministic` (31 functions, 1 classes)
📄 `src.extractors.docs-llm` (24 functions, 1 classes)
📄 `src.extractors.docs-record` (36 functions)
📄 `src.extractors.docs-schema` (1 functions)
📄 `src.extractors.docs-types` (7 classes)
📄 `src.extractors.git` (29 functions, 3 classes)
📄 `src.extractors.markdown` (3 functions, 1 classes)
📄 `src.extractors.markdown-block` (3 functions, 1 classes)
📄 `src.extractors.markdown-llm` (31 functions, 4 classes)
📄 `src.extractors.nl` (12 functions, 1 classes)
📄 `src.extractors.nl-llm` (38 functions, 4 classes)
📄 `src.extractors.todo` (17 functions)
📄 `src.graph.diagnostics` (26 functions)
📄 `src.graph.diff` (38 functions, 1 classes)
📄 `src.graph.linker` (73 functions, 4 classes)
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
📄 `src.llm.audit` (1 functions)
📄 `src.llm.failure` (2 functions, 1 classes)
📄 `src.llm.openrouter` (43 functions, 7 classes)
📄 `src.operations.artifact` (10 functions, 2 classes)
📄 `src.operations.compile-cli` (7 functions)
📄 `src.operations.contract` (8 functions)
📄 `src.operations.subactor` (10 functions, 1 classes)
📄 `src.operations.types` (8 classes)
📄 `src.operations.validation` (47 functions)
📄 `src.pipeline.run` (64 functions, 1 classes)
📄 `src.sdk.typescript` (16 functions, 6 classes)
📄 `src.services.actions` (113 functions)
📄 `src.summary.payload` (8 functions)
📄 `src.summary.render` (14 functions)
📄 `src.summary.summarizer` (47 functions, 5 classes)
📄 `src.synthesis.code-change-path` (14 functions)
📄 `src.synthesis.code-change-plan` (139 functions, 10 classes)
📄 `src.synthesis.tasks-llm` (84 functions, 7 classes)
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