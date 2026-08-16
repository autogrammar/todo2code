<!-- code2docs:start --># todo2code

![version](https://img.shields.io/badge/version-0.1.0-blue) ![typescript](https://img.shields.io/badge/typescript-%3E%3D20-3178C6) ![coverage](https://img.shields.io/badge/coverage-unknown-lightgrey) ![functions](https://img.shields.io/badge/functions-4221-green)
> **4221** functions | **429** classes | **310** files | CC̄ = 3.8

> Auto-generated project documentation from source code analysis.

**Author:** Tom Softreck <tom@sapletta.com>  
**License:** Apache-2.0[(LICENSE)](./LICENSE)  
**Repository:** [https://github.com/autogrammar/todo2code](https://github.com/autogrammar/todo2code)

## Installation

### Requirements

- Node.js >=20
### From Source

```bash
git clone https://github.com/autogrammar/todo2code
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
├── TASK
├── goal
    ├── e2e
├── Makefile
├── docker-compose
├── Dockerfile
├── tsconfig
├── nlp2uri
├── dsl-manifest
├── AGENTS
├── pyproject
├── CONTRIBUTION
├── project2
├── package
├── project
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
        ├── schema
        ├── schema
        ├── schema
        ├── schema
        ├── schema
    ├── Cargo
        ├── main
    ├── PROTOCOLS
    ├── DSL
    ├── TEAM_COMMUNICATION
    ├── READINESS
    ├── EVENT_LOG_DSL
    ├── PIPELINE_DSL_NL
    ├── DEMOLLM
    ├── CODE_CHANGE_PLANS
    ├── REQUIREMENTS
    ├── VALIDATION
    ├── E2E
    ├── GROK-PLAN
    ├── OPTIMIZATION
    ├── TEST_REPORT
    ├── SYSTEM_MONITOROWANIA_INTENCJI_I_PRACY_AGENTOW
    ├── SUBACTOR_OPERATION_DSL
    ├── ARCHITECTURE
    ├── SECURITY
    ├── PROJECT_STATUS
    ├── CLI_GUIDE
    ├── README
        ├── ALL_DIAGRAMS
        ├── README
        ├── original-monitoring-design
    ├── task
    ├── TODO
    ├── CHANGELOG
        ├── task
        ├── tsconfig
        ├── TODO
        ├── CHANGELOG
        ├── README
            ├── validation
            ├── store
            ├── server
        ├── task
        ├── tsconfig
        ├── TODO
        ├── CHANGELOG
        ├── README
            ├── api
            ├── render
            ├── app
        ├── ARCHITECTURE
        ├── helper
        ├── runtime
        ├── participants
                        ├── 001
                        ├── 001
                        ├── 001
                        ├── 002
                        ├── 001
        ├── python
        ├── typescript
    ├── JavaAstExtract
├── src/
    ├── cli
    ├── version
        ├── nl
        ├── ast
        ├── runtime-cycle
        ├── configuration
        ├── docs-schema
        ├── nl-llm
        ├── docs-llm
        ├── markdown
        ├── changelog
        ├── docs-deterministic
        ├── markdown-paths
        ├── docs-record
        ├── todo
        ├── markdown-block
        ├── communication
        ├── git
        ├── docs-chunks
        ├── markdown-llm
        ├── docs-types
            ├── types
            ├── rust
            ├── external
            ├── python
            ├── go
            ├── php
            ├── unsupported
            ├── records
            ├── java
            ├── typescript
        ├── diff
        ├── symbol-resolution
        ├── linker
        ├── diagnostics
        ├── changelog-signal
        ├── capability-evidence
        ├── branch-snapshot
        ├── actions
        ├── workspace-preflight
        ├── branch-portfolio-assembler
        ├── classifier
        ├── types
        ├── target
        ├── text
        ├── security
        ├── branch-portfolio
        ├── ignore
        ├── truth-map
        ├── id
        ├── grounding
        ├── version
        ├── record
        ├── io
        ├── content-cache
        ├── schema
        ├── diff-ui
        ├── reranker-llm
        ├── reranker-response
        ├── reranker
        ├── task-synthesis-payload
        ├── code-change-path
        ├── task-synthesis-materialize
        ├── todo-patch
        ├── task-synthesis-contract
        ├── validation
        ├── code-change-plan
        ├── tasks-llm
        ├── workspace
        ├── openrouter
        ├── failure
        ├── audit
        ├── openrouter-timeout
        ├── subllm
        ├── structured-schema
        ├── env
        ├── a2a-card
        ├── a2a-message
        ├── mcp-errors
        ├── governed-intake
        ├── mcp
        ├── a2a
        ├── a2a-types
        ├── mcp-tools
        ├── mcp-resources
        ├── a2a-task-store
        ├── intake-actions
        ├── intake_cli
        ├── a2a-history
                ├── schema
                ├── schema
                ├── schema
                ├── schema
                ├── schema
                ├── schema
                ├── schema
        ├── svg
        ├── text
        ├── reality
        ├── text-types
        ├── git
        ├── text-render
        ├── payload
        ├── summarizer
        ├── render
        ├── event-log
        ├── run
        ├── event-log-persistence
        ├── gold-extraction
        ├── gold-types
        ├── analysis-policy
        ├── gold-cases
        ├── gold-metrics
        ├── gold
        ├── gold-cli
        ├── contract-check
        ├── model-comparison
        ├── types
        ├── artifact
        ├── subactor
        ├── validation
        ├── contract
        ├── compile-cli
        ├── watcher
        ├── typescript
        ├── intake-contract
        ├── llm
        ├── intake-protobuf
        ├── analyzer
        ├── intake-service
        ├── identity
        ├── intake-store
    ├── ast_extract
    ├── ast_extract
        ├── system
        ├── system
        ├── system
        ├── system
        ├── system
        ├── system
    ├── assert-demollm-run
    ├── verify-env-contract
    ├── package
    ├── e2e
    ├── verify-structured-responses
    ├── normalize-generated-analysis-roots
    ├── generate-response-schemas
    ├── a2a-request
    ├── live-model-comparison
    ├── vallm-compatible
    ├── mcp-request
    ├── docker-smoke
    ├── workspace-preflight
    ├── examples-check
    ├── live-contract-check
    ├── sync-generated-readme-metadata
    ├── github-event-log
    ├── verify-no-llm-imports
    ├── runtime
    ├── verify-generated-analysis
    ├── verify-workflow-yaml
    ├── verify-module-boundaries
    ├── smoke
        ├── evaluate-embedding-pairs
        ├── rerank-embedding-shortlist
        ├── audit-changelog-sample
        ├── rank-intent-graph-embeddings
        ├── README
        ├── package
        ├── README
            ├── dataset
            ├── dataset
    ├── requirements
    ├── ast_extract
├── sdk/
    ├── README
        ├── client
        ├── todo2code
        ├── types
        ├── actions
        ├── README
                ├── main
        ├── tsconfig
        ├── package
        ├── README
            ├── basic
        ├── src/
        ├── Cargo
        ├── README
            ├── basic
            ├── actions
            ├── error
        ├── src
            ├── types
            ├── client
        ├── composer
        ├── README
            ├── basic
            ├── Client
            ├── Error
        ├── todo2code_sdk
    ├── python/
        ├── README
            ├── basic
            ├── local_runtime
            ├── runtime
        ├── todo2code/
            ├── client
├── planfile
├── TODO
├── prefact
├── CHANGELOG
            ├── toon
```

## API Overview

### Classes

- **`Fact`** — —
- **`Output`** — —
- **`Collector`** — —
- **`ValidationResult`** — —
- **`IntentEvent`** — —
- **`EventPage`** — —
- **`EventStore`** — —
- **`BackendOptions`** — —
- **`IntentEvent`** — —
- **`EventPage`** — —
- **`ApiError`** — —
- **`PanelRow`** — —
- **`PanelState`** — —
- **`Contract`** — —
- **`JavaAstExtract`** — —
- **`ParsedArgs`** — —
- **`NlExtractionOptions`** — —
- **`AstExtractionOptions`** — —
- **`ExternalCacheAdapter`** — —
- **`CycleContext`** — —
- **`Config2DslOptions`** — —
- **`ConfigurationEntry`** — —
- **`RawNlRecord`** — —
- **`NlResponse`** — —
- **`AuditedNlExtractionResult`** — —
- **`NlLlmRequiredError`** — —
- **`NlAttemptError`** — —
- **`DocumentationLlmRequiredError`** — —
- **`MarkdownExtractionOptions`** — —
- **`DeterministicDocumentationOptions`** — —
- **`Docs2DslOptions`** — —
- **`MarkdownPathResolver`** — —
- **`MarkdownListBlock`** — —
- **`CommunicationExtractionOptions`** — —
- **`CommunicationEnvelope`** — —
- **`InferredCommunicationIdentity`** — —
- **`CommunicationSegment`** — —
- **`CommunicationCandidate`** — —
- **`CommunicationAttribution`** — —
- **`GitCommit`** — —
- **`ChangedFile`** — —
- **`GitExtractionOptions`** — —
- **`MarkdownEnrichment`** — —
- **`MarkdownResponse`** — —
- **`AuditedMarkdownExtractionResult`** — —
- **`MarkdownLlmRequiredError`** — —
- **`MarkdownAttemptError`** — —
- **`CoveredBatch`** — —
- **`RawDocumentRecord`** — —
- **`DocumentResponse`** — —
- **`DocumentChunk`** — —
- **`DocumentationTargetHints`** — —
- **`DocumentationExtractionOptions`** — —
- **`DocumentationExtractionResult`** — —
- **`DocumentChunkResult`** — —
- **`AdapterFact`** — —
- **`AdapterOutput`** — —
- **`ExternalAdapterOptions`** — —
- **`DiffSvgOptions`** — —
- **`AstSymbolCandidate`** — —
- **`NlSymbolResolution`** — —
- **`SymbolResolutionIndex`** — —
- **`PairEvidence`** — —
- **`RecordKeywords`** — —
- **`DirectedRelation`** — —
- **`SourceRelationRule`** — —
- **`BranchGitSnapshotOptions`** — —
- **`BranchGitBaseSnapshot`** — —
- **`BranchGitCandidateSnapshot`** — —
- **`BranchGitInteractionSnapshot`** — —
- **`BranchGitMaterialization`** — —
- **`BranchSnapshotHooks`** — —
- **`RefSnapshot`** — —
- **`GitCommandOptions`** — —
- **`GitCommandResult`** — —
- **`WorkspacePreflightOptions`** — —
- **`WorkspaceDirtyEntry`** — —
- **`WorkspaceDiagnostic`** — —
- **`WorkspaceGovernanceReport`** — —
- **`WorkspacePreflightReport`** — —
- **`CommandResult`** — —
- **`GovernanceResult`** — —
- **`GovernanceInvocation`** — —
- **`WorkspaceDiagnosticFacts`** — —
- **`WorkspacePreflightError`** — —
- **`GovernanceArguments`** — —
- **`GovernanceExecution`** — —
- **`BranchSemanticTreeBundle`** — —
- **`BranchPortfolioAssembly`** — —
- **`CandidateSemanticState`** — —
- **`AssertionMapping`** — —
- **`TfTensor`** — —
- **`TfModel`** — —
- **`TfModule`** — —
- **`ModelAssets`** — —
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
- **`BranchCitationSet`** — —
- **`BranchAssertionChange`** — —
- **`BranchBaseEvidence`** — —
- **`BranchCandidateEvidence`** — —
- **`BranchPairEvidence`** — —
- **`BranchPortfolioEvidence`** — —
- **`BranchCandidateResult`** — —
- **`BranchInteractionResult`** — —
- **`BranchPortfolio`** — —
- **`IgnoreRule`** — —
- **`IgnoreMatcher`** — —
- **`LoadIgnoreOptions`** — —
- **`TruthMapSourceReference`** — —
- **`TruthMapEvidenceLanes`** — —
- **`TruthMapAssertion`** — —
- **`TruthMap`** — —
- **`RecordComponents`** — —
- **`BuildRecordGenerationInput`** — —
- **`BuildRecordInput`** — —
- **`WalkOptions`** — —
- **`CacheEnvelope`** — —
- **`ContentCacheOptions`** — —
- **`ContentCacheEntryOptions`** — —
- **`ContentCache`** — —
- **`GroundedValidationContext`** — —
- **`TodoProposalValidationContext`** — —
- **`CodeChangePlanValidationContext`** — —
- **`CodeChangeAcceptanceValidationContext`** — —
- **`SemanticRerankerOptions`** — —
- **`SemanticRerankerRequiredError`** — —
- **`SemanticRerankerResponse`** — —
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
- **`CreateTodoPatchOptions`** — —
- **`CreatedTodoPatch`** — —
- **`WriteTodoPatchOptions`** — —
- **`WrittenTodoPatch`** — —
- **`ApplyTodoPatchOptions`** — —
- **`RawConclusion`** — —
- **`RawProposal`** — —
- **`RawTaskSynthesisResponse`** — —
- **`TodoProposalDuplicate`** — —
- **`TodoProposalValidationResult`** — —
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
- **`RawDiagnosticAction`** — —
- **`AuditedTaskSynthesisResult`** — —
- **`TaskSynthesisRequiredError`** — —
- **`TaskSynthesisAttemptError`** — —
- **`WorkspaceComparisonDeadlineLoad`** — —
- **`WorkspaceComparisonDeadlineDecision`** — —
- **`WorkspaceComparisonOptions`** — —
- **`CoverageSnapshot`** — —
- **`WorkspaceComparison`** — —
- **`ChatMessage`** — —
- **`OpenRouterChoice`** — —
- **`OpenRouterResponse`** — —
- **`OpenRouterResult`** — —
- **`OpenRouterModelsResponse`** — —
- **`LlmTransport`** — —
- **`OpenRouterModelError`** — —
- **`OpenRouterClient`** — —
- **`LlmFailureReason`** — —
- **`OpenRouterTimeoutLoad`** — —
- **`OpenRouterTimeoutDecision`** — —
- **`SubllmPublicRoute`** — —
- **`ResolvedSubllmRoute`** — —
- **`StructuredSchema`** — —
- **`StructuredResponseError`** — —
- **`StringOptions`** — —
- **`NumberOptions`** — —
- **`ArrayOptions`** — —
- **`T2CConfig`** — —
- **`McpRequestError`** — —
- **`JsonRpcRequest`** — —
- **`McpConnectionState`** — —
- **`JsonRpcRequest`** — —
- **`A2APart`** — —
- **`A2AMessage`** — —
- **`A2AArtifact`** — —
- **`A2ATask`** — —
- **`StoredTask`** — —
- **`SendConfiguration`** — —
- **`A2ARequestError`** — —
- **`BodyTooLargeError`** — —
- **`McpTool`** — —
- **`PreparedTask`** — —
- **`ListCursor`** — —
- **`TaskStoreSnapshot`** — —
- **`IntentRunListItem`** — —
- **`CommunicationRunSummary`** — —
- **`RunHistoryFilters`** — —
- **`SvgTheme`** — —
- **`SvgDocumentOptions`** — —
- **`RawOp`** — —
- **`RealityRow`** — —
- **`IntentRealityView`** — —
- **`RealitySvgOptions`** — —
- **`DiffLine`** — —
- **`DiffHunk`** — —
- **`FileDiff`** — —
- **`DiffTextOptions`** — —
- **`GitDiffOptions`** — —
- **`GitDiffResult`** — —
- **`ChangedEntry`** — —
- **`TextDiffSvgOptions`** — —
- **`SideBySideRow`** — —
- **`SummaryResult`** — —
- **`SummaryOptions`** — —
- **`RawConclusion`** — —
- **`RawSummaryResponse`** — —
- **`SummaryAttemptError`** — —
- **`EventLogEventInput`** — —
- **`EventLogEvent`** — —
- **`EventLogDocument`** — —
- **`EventLogError`** — —
- **`PipelineResult`** — —
- **`ExtractionResult`** — —
- **`AnalysisResult`** — —
- **`SynthesisResult`** — —
- **`PlanningResult`** — —
- **`PipelineSummaryResult`** — —
- **`OutputPaths`** — —
- **`PipelineRun`** — —
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
- **`AnalysisBudget`** — —
- **`AnalysisStage`** — —
- **`AnalysisPolicy`** — —
- **`AnalysisUsageCeiling`** — —
- **`AnalysisCacheIdentity`** — —
- **`AnalysisPolicyError`** — —
- **`PolicyReader`** — —
- **`LinkingCaseResult`** — —
- **`RerankingCaseResult`** — —
- **`DiagnosticsCaseResult`** — —
- **`Dsl2TodoCaseResult`** — —
- **`Counts`** — —
- **`EvaluationCore`** — —
- **`EvaluationRun`** — —
- **`EvaluationResult`** — —
- **`LiveBudget`** — —
- **`LiveStageMeasurement`** — —
- **`LiveHistoryRecord`** — —
- **`LiveHistoryStageSummary`** — —
- **`LiveHistorySummary`** — —
- **`LiveContractAudit`** — —
- **`LiveModelRun`** — —
- **`LiveModelMeasurement`** — —
- **`LiveModelAgreement`** — —
- **`LiveModelComparison`** — —
- **`VariableContract`** — —
- **`OperationParameterReference`** — —
- **`OperationRollback`** — —
- **`OperationStep`** — —
- **`OperationExpectation`** — —
- **`OperationPlan`** — —
- **`ResolvedVariableBinding`** — —
- **`SubactorProcessEnvelope`** — —
- **`CompileOperationPlanArtifactOptions`** — —
- **`OperationPlanCompilationReceipt`** — —
- **`CompileSubactorEnvelopeOptions`** — —
- **`SnapshotDelta`** — —
- **`ScanOptions`** — —
- **`ReportResult`** — —
- **`WatchOptions`** — —
- **`Todo2CodeClientOptions`** — —
- **`DiffResult`** — —
- **`FileDiffResult`** — —
- **`GitDiffResponse`** — —
- **`RealityResult`** — —
- **`Todo2CodeClient`** — —
- **`VerifiedPrincipal`** — —
- **`ParticipantV2`** — —
- **`ParticipantRegistryV2`** — —
- **`IntakeEnvelope`** — —
- **`IntakeDiagnostic`** — —
- **`IntakeResult`** — —
- **`IntakeError`** — —
- **`RawCommunicationEnrichment`** — —
- **`RawParticipantSynthesis`** — —
- **`RawCommunicationResponse`** — —
- **`ParticipantCommunicationSynthesis`** — —
- **`AuditedCommunicationExtractionResult`** — —
- **`CommunicationLlmRequiredError`** — —
- **`CommunicationAttemptError`** — —
- **`ParticipantGroup`** — —
- **`CommunicationIssue`** — —
- **`ParticipantCommunicationAnalysis`** — —
- **`CommunicationAnalysis`** — —
- **`IntakeState`** — —
- **`GovernedIntakeService`** — —
- **`ParticipantIdentityEntry`** — —
- **`ParticipantIdentityRegistry`** — —
- **`LoadedParticipantIdentityRegistry`** — —
- **`IntakeEvent`** — —
- **`StreamSnapshot`** — —
- **`IntakeEventStore`** — —
- **`Fact`** — —
- **`output`** — —
- **`factCollector`** — —
- **`FactVisitor`** — —
- **`Client`** — —
- **`rpcRequest`** — —
- **`rpcResponse`** — —
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
- **`Client`** — —
- **`Client`** — —
- **`Error`** — —
- **`Todo2CodeClient`** — Diff-focused client for the todo2code runtime.
- **`TypeScriptRuntimeError`** — Raised when the local Node/TypeScript runtime cannot be executed.
- **`RuntimeResult`** — Raw result of a local TypeScript CLI invocation.
- **`TypeScriptRuntime`** — Execute the canonical TypeScript runtime from a Python process.
- **`T2CError`** — Raised for JSON-RPC errors, transport failures and non-completed tasks.
- **`IntentRecord`** — A single t2c.intent/v1 record.
- **`ExtractionResult`** — Records, warnings and the optional audited LLM stage result.
- **`Diagnostic`** — —
- **`DiagnosticReport`** — —
- **`IntentGraph`** — —
- **`T2CClient`** — Client for the todo2code A2A endpoint.

### Functions

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
- `load_task(path)` — —
- `normalize_task(value)` — —
- `validateContract()` — —
- `executeContract()` — —
- `client()` — —
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
- `cycle()` — —
- `handleCommunication()` — —
- `analysis()` — —
- `graphOut()` — —
- `emitExtraction()` — —
- `emitJson()` — —
- `handleIntake()` — —
- `operation()` — —
- `absolute()` — —
- `intakeExitCode()` — —
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
- `code2dsl()` — —
- `root()` — —
- `result()` — —
- `extractAstIntent()` — —
- `cache()` — —
- `matcher()` — —
- `files()` — —
- `body()` — —
- `relative()` — —
- `extracted()` — —
- `adapterFiles()` — —
- `manifest()` — —
- `unsupported()` — —
- `sourceManifest()` — —
- `isIntentRecords()` — —
- `isExtractionResult()` — —
- `requireStandaloneRoot()` — —
- `MAX_PER_SECTION()` — —
- `extractRuntimeCycleIntent()` — —
- `cyclePath()` — —
- `root()` — —
- `body()` — —
- `cycle()` — —
- `sourcePath()` — —
- `observedAt()` — —
- `host()` — —
- `results()` — —
- `parseCycle()` — —
- `sourcePathFor()` — —
- `relative()` — —
- `boundedArray()` — —
- `objects()` — —
- `label()` — —
- `text()` — —
- `tags()` — —
- `watched()` — —
- `declared()` — —
- `probeRecord()` — —
- `id()` — —
- `failed()` — —
- `error()` — —
- `outcome()` — —
- `violationRecord()` — —
- `probe()` — —
- `fact()` — —
- `driftRecord()` — —
- `proposalRecord()` — —
- `kind()` — —
- `detail()` — —
- `proposalAction()` — —
- `factsMetadata()` — —
- `jsonScalar()` — —
- `MAX_ENTRIES_PER_FILE()` — —
- `config2dsl()` — —
- `root()` — —
- `result()` — —
- `extractConfigurationIntent()` — —
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
- `requireStandaloneRoot()` — —
- `strings()` — —
- `target()` — —
- `documentRecord()` — —
- `documentResponseContract()` — —
- `documentResponseSchema()` — —
- `extractMarkdownIntent()` — —
- `pathResolver()` — —
- `todo()` — —
- `changelog()` — —
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
- `docs2dsl()` — —
- `root()` — —
- `files()` — —
- `result()` — —
- `extractDocumentationBaseline()` — —
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
- `requireStandaloneRoot()` — —
- `requireStringList()` — —
- `resolveOwnedFiles()` — —
- `absolute()` — —
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
- `readListBlock()` — —
- `cursor()` — —
- `line()` — —
- `extractCommunicationIntent()` — —
- `root()` — —
- `projectRoot()` — —
- `files()` — —
- `identityRegistry()` — —
- `communicationFiles()` — —
- `loaded()` — —
- `extracted()` — —
- `loadCommunicationCandidate()` — —
- `relativeToProject()` — —
- `parts()` — —
- `pathTicket()` — —
- `envelope()` — —
- `inferred()` — —
- `explicitEnvelope()` — —
- `matchesRequestedTicket()` — —
- `readCommunicationFile()` — —
- `detail()` — —
- `shouldIgnoreCommunicationCandidate()` — —
- `hasExplicitCommunicationEnvelope()` — —
- `convertCommunicationCandidate()` — —
- `attribution()` — —
- `warnings()` — —
- `governanceRole()` — —
- `segments()` — —
- `records()` — —
- `resolveAttribution()` — —
- `resolveParticipantAttribution()` — —
- `declaredParticipant()` — —
- `declaredRole()` — —
- `declaredParticipantId()` — —
- `entry()` — —
- `participant()` — —
- `declaredGitAuthors()` — —
- `resolvedParticipant()` — —
- `resolvedDisplayName()` — —
- `resolveMessageAttribution()` — —
- `explicitMessageType()` — —
- `rawTimestamp()` — —
- `resolveTargetAttribution()` — —
- `attributionWarnings()` — —
- `basicAttributionWarnings()` — —
- `registryAttributionWarnings()` — —
- `source()` — —
- `timestampAttributionWarnings()` — —
- `buildCommunicationIntentRecord()` — —
- `semantics()` — —
- `classified()` — —
- `action()` — —
- `line()` — —
- `communicationMetadata()` — —
- `resolveIdentity()` — —
- `sameStrings()` — —
- `normalize()` — —
- `normalizedLeft()` — —
- `normalizedRight()` — —
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
- `jsonValues()` — —
- `stripped()` — —
- `jsonStringList()` — —
- `unquote()` — —
- `validTimestamp()` — —
- `parsed()` — —
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
- `MARKDOWN_LLM_BATCH_RECORDS()` — —
- `extractRustAst()` — —
- `helperPath()` — —
- `execFileAsync()` — —
- `runExternalAstAdapter()` — —
- `files()` — —
- `result()` — —
- `parsed()` — —
- `extractPythonAst()` — —
- `helperPath()` — —
- `matcher()` — —
- `files()` — —
- `temporaryDirectory()` — —
- `filesPath()` — —
- `extractGoAst()` — —
- `helperPath()` — —
- `extractPhpAst()` — —
- `helperPath()` — —
- `matcher()` — —
- `files()` — —
- `temporaryDirectory()` — —
- `filesPath()` — —
- `unsupportedSourceWarning()` — —
- `files()` — —
- `counts()` — —
- `extension()` — —
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
- `extractJavaAst()` — —
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
- `MAX_CANDIDATES()` — —
- `MAX_CHANGED_PATHS()` — —
- `MAX_GIT_OUTPUT()` — —
- `assertBranchGitMaterialization()` — —
- `materialization()` — —
- `candidates()` — —
- `materializeBranchGitSnapshot()` — —
- `root()` — —
- `captured()` — —
- `base()` — —
- `temporaryRoot()` — —
- `mergeEnvironment()` — —
- `inspect()` — —
- `interactions()` — —
- `result()` — —
- `validateOptions()` — —
- `validateSnapshotIdentity()` — —
- `validateCandidateRefs()` — —
- `seen()` — —
- `validateRef()` — —
- `invalid()` — —
- `repositoryRoot()` — —
- `inside()` — —
- `captureRef()` — —
- `symbolic()` — —
- `resolved()` — —
- `treeSha()` — —
- `captureCandidate()` — —
- `mergeBaseSha()` — —
- `counts()` — —
- `changedPaths()` — —
- `captureInteractions()` — —
- `left()` — —
- `right()` — —
- `textualMerge()` — —
- `readChangedPaths()` — —
- `output()` — —
- `values()` — —
- `stablePatchId()` — —
- `diff()` — —
- `patchId()` — —
- `isolatedObjectEnvironment()` — —
- `gitCommonDir()` — —
- `commonDirectory()` — —
- `sourceObjects()` — —
- `temporaryObjects()` — —
- `inspectTextualMerge()` — —
- `classifyMergeTreeResult()` — —
- `assertRefsUnchanged()` — —
- `fingerprintMaterialization()` — —
- `validateMaterializationIdentity()` — —
- `validateMaterializationCandidates()` — —
- `validateMaterializationCandidate()` — —
- `value()` — —
- `validateMaterializedPaths()` — —
- `validateMaterializationInteractions()` — —
- `expected()` — —
- `materializationPairKeys()` — —
- `materializationObject()` — —
- `requireMaterializationKeys()` — —
- `requireMaterializationSha()` — —
- `requireMaterializationCount()` — —
- `requireMaterializationMerge()` — —
- `requiredSnapshot()` — —
- `parseCounts()` — —
- `parts()` — —
- `pathsOverlap()` — —
- `rightPaths()` — —
- `startsWithSha()` — —
- `requireSha()` — —
- `requiredGit()` — —
- `requiredGitBuffer()` — —
- `gitFailure()` — —
- `detail()` — —
- `runGit()` — —
- `child()` — —
- `maxBuffer()` — —
- `bytes()` — —
- `overflow()` — —
- `collect()` — —
- `stdoutBuffer()` — —
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
- `MAX_OUTPUT()` — —
- `MAX_DIRTY_PATHS()` — —
- `MAX_CHANGED_ARGUMENT_BYTES()` — —
- `assembleBranchPortfolio()` — —
- `bundles()` — —
- `baseBundle()` — —
- `states()` — —
- `stateByRef()` — —
- `indexSemanticBundles()` — —
- `missing()` — —
- `extra()` — —
- `validateSemanticBundle()` — —
- `buildCandidateState()` — —
- `diff()` — —
- `mapping()` — —
- `semanticEvidence()` — —
- `baseSemanticConflict()` — —
- `mapAssertionChanges()` — —
- `baseAssertions()` — —
- `candidateByBase()` — —
- `afterToBefore()` — —
- `anchors()` — —
- `values()` — —
- `mapped()` — —
- `assertionAnchors()` — —
- `baseRecord()` — —
- `anchor()` — —
- `changeFromAssertions()` — —
- `changedIdentityIsAmbiguous()` — —
- `counts()` — —
- `count()` — —
- `semanticCompleteness()` — —
- `changedConflictCitations()` — —
- `conflicted()` — —
- `assertionId()` — —
- `buildPairEvidence()` — —
- `complete()` — —
- `semanticConflict()` — —
- `pairConflictCitations()` — —
- `leftChange()` — —
- `rightChange()` — —
- `removalConflict()` — —
- `explicitConflict()` — —
- `citationsForChanges()` — —
- `requiredBundle()` — —
- `bundle()` — —
- `requiredState()` — —
- `state()` — —
- `requiredAssertionId()` — —
- `id()` — —
- `uniqueAssertions()` — —
- `unique()` — —
- `uniqueSorted()` — —
- `cloneEmptyCitations()` — —
- `requireExactKeys()` — —
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
- `MAX_CANDIDATES()` — —
- `MAX_ASSERTION_CHANGES()` — —
- `TEXTUAL_MERGES()` — —
- `COMPLETENESS()` — —
- `CHANGE_KINDS()` — —
- `ORDERINGS()` — —
- `projectBranchPortfolio()` — —
- `portfolio()` — —
- `assertBranchPortfolioEvidence()` — —
- `candidates()` — —
- `assertBranchPortfolio()` — —
- `expected()` — —
- `buildPortfolio()` — —
- `candidateIndex()` — —
- `interactions()` — —
- `validateBase()` — —
- `validateCandidates()` — —
- `validateCandidate()` — —
- `validatePullRequests()` — —
- `seen()` — —
- `validateAssertionChanges()` — —
- `assertionId()` — —
- `validateConflict()` — —
- `allowed()` — —
- `other()` — —
- `validateConflictDetails()` — —
- `records()` — —
- `relations()` — —
- `validateCitations()` — —
- `allowedKeys()` — —
- `validatePairs()` — —
- `observed()` — —
- `key()` — —
- `validatePair()` — —
- `left()` — —
- `right()` — —
- `validatePairCitations()` — —
- `validateOrderingEvidence()` — —
- `ordered()` — —
- `buildInteraction()` — —
- `sharedAssertionIds()` — —
- `classifyInteraction()` — —
- `buildCandidate()` — —
- `relevant()` — —
- `reasons()` — —
- `changes()` — —
- `recommendationFor()` — —
- `candidateReasons()` — —
- `addInteractionReason()` — —
- `hasCandidateConflict()` — —
- `waitsForCandidate()` — —
- `normalizePair()` — —
- `ordering()` — —
- `canonicalChanges()` — —
- `canonicalCitations()` — —
- `buildStats()` — —
- `byClassification()` — —
- `byRecommendation()` — —
- `emptyClassificationCounts()` — —
- `emptyRecommendationCounts()` — —
- `portfolioFingerprint()` — —
- `assertionIds()` — —
- `isDuplicateIdentity()` — —
- `hasConflict()` — —
- `expectedPairKeys()` — —
- `leftName()` — —
- `rightName()` — —
- `pairKey()` — —
- `intersection()` — —
- `values()` — —
- `uniqueSorted()` — —
- `requireExactKeys()` — —
- `requireRepository()` — —
- `requireBranchName()` — —
- `malformed()` — —
- `requireSha()` — —
- `requireDigest()` — —
- `requireCount()` — —
- `requireText()` — —
- `requireUniqueIds()` — —
- `requireSubset()` — —
- `requireEnum()` — —
- `requireDateTime()` — —
- `parsed()` — —
- `compareById()` — —
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
- `MAPPING_RELATIONS()` — —
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
- `groundRecordIdsByDiagnostics()` — —
- `diagnosticById()` — —
- `allowed()` — —
- `suppliedGrounded()` — —
- `sortedUnique()` — —
- `buildRecord()` — —
- `rawExcerpt()` — —
- `withRecordGeneration()` — —
- `generationMetadata()` — —
- `used()` — —
- `extractorIdentity()` — —
- `separator()` — —
- `clamp()` — —
- `sourcePrefix()` — —
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
- `diffUiHtml()` — —
- `byId()` — —
- `requestHeaders()` — —
- `formatBytes()` — —
- `selectedRun()` — —
- `updateMeta()` — —
- `fillSelect()` — —
- `loadRuns()` — —
- `compareGraphs()` — —
- `RERANK_DECISION_CONTRACT()` — —
- `SEMANTIC_RERANK_RESPONSE_CONTRACT()` — —
- `SEMANTIC_RERANK_RESPONSE_SCHEMA()` — —
- `assertSemanticRerankerResponse()` — —
- `response()` — —
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
- `compactSynthesisPayload()` — —
- `recordIds()` — —
- `todoRecords()` — —
- `records()` — —
- `includedIds()` — —
- `groundedDiagnostics()` — —
- `compactRecord()` — —
- `compareDiagnostics()` — —
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
- `execFileAsync()` — —
- `WORKSPACE_COMPARISON_DEADLINE_POLICY()` — —
- `calculateWorkspaceComparisonDeadline()` — —
- `baseDeadlineMs()` — —
- `pressure()` — —
- `steps()` — —
- `multiplier()` — —
- `scaledDeadlineMs()` — —
- `effectiveDeadlineMs()` — —
- `capped()` — —
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
- `deadlineDecision()` — —
- `deadlineController()` — —
- `inheritedSignal()` — —
- `abortFromInheritedSignal()` — —
- `deadlineExpired()` — —
- `deadlineTimer()` — —
- `temporaryParent()` — —
- `baseWorktree()` — —
- `baseRoot()` — —
- `pipelineOptions()` — —
- `baseOptions()` — —
- `currentOptions()` — —
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
- `workspaceComparisonDeadlineLoad()` — —
- `files()` — —
- `addIfPresent()` — —
- `absolute()` — —
- `relative()` — —
- `documentFiles()` — —
- `documentFileSet()` — —
- `inputBytes()` — —
- `documentChunks()` — —
- `size()` — —
- `markdownMode()` — —
- `communicationMode()` — —
- `semanticUnitsPerPipeline()` — —
- `assertNonNegativeInteger()` — —
- `scopedOutputDirectory()` — —
- `commonPipelineOptions()` — —
- `defaulted()` — —
- `optionsForRoot()` — —
- `existingFile()` — —
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
- `BEARER_CREDENTIAL_RE()` — —
- `SECRET_ASSIGNMENT_RE()` — —
- `CREDENTIAL_IDENTIFIER_RE()` — —
- `classifyLlmFailure()` — —
- `message()` — —
- `rejectedLlmResponseMetadata()` — —
- `openRouterAuditConfiguration()` — —
- `subllmEnabled()` — —
- `route()` — —
- `subllmRoutingEnabled()` — —
- `OPENROUTER_TIMEOUT_POLICY()` — —
- `calculateOpenRouterTimeout()` — —
- `complexityPoints()` — —
- `pressure()` — —
- `steps()` — —
- `multiplier()` — —
- `scaledTimeoutMs()` — —
- `effectiveTimeoutMs()` — —
- `capped()` — —
- `openRouterRequestTimeout()` — —
- `messages()` — —
- `plugins()` — —
- `responseFormat()` — —
- `jsonSchema()` — —
- `maxTokens()` — —
- `optionalArray()` — —
- `optionalObject()` — —
- `assertPositiveFinite()` — —
- `assertNonNegativeInteger()` — —
- `execFileAsync()` — —
- `FALSE_VALUES()` — —
- `TRUE_VALUES()` — —
- `lastResolvedSubllmRoute()` — —
- `shouldUseSubllm()` — —
- `explicit()` — —
- `resolveSubllmRoute()` — —
- `commandEnvironment()` — —
- `python()` — —
- `routeOutput()` — —
- `route()` — —
- `credential()` — —
- `localSubllmPythonPath()` — —
- `candidate()` — —
- `requireFile()` — —
- `stat()` — —
- `subllmCommandEnvironment()` — —
- `pythonPath()` — —
- `inherited()` — —
- `resolvedPythonPath()` — —
- `parsePublicRoute()` — —
- `provider()` — —
- `extraHeaders()` — —
- `requiredString()` — —
- `value()` — —
- `requiredNumber()` — —
- `requiredHttpsUrl()` — —
- `parsed()` — —
- `requiredEnvName()` — —
- `isRecord()` — —
- `credentialFromSharedFile()` — —
- `envPath()` — —
- `message()` — —
- `parseCredential()` — —
- `values()` — —
- `credentialAssignment()` — —
- `line()` — —
- `separator()` — —
- `unquoteCredential()` — —
- `doubleQuoted()` — —
- `singleQuoted()` — —
- `redactDiagnostic()` — —
- `runSubllm()` — —
- `result()` — —
- `error()` — —
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
- `projectFolderLabel()` — —
- `configForDisplay()` — —
- `hasOpenRouter()` — —
- `sendAgentCard()` — —
- `card()` — —
- `serialized()` — —
- `payload()` — —
- `agentCard()` — —
- `skills()` — —
- `skill()` — —
- `parseSendConfiguration()` — —
- `validateOutputModes()` — —
- `supported()` — —
- `parseCommand()` — —
- `protobuf()` — —
- `bytes()` — —
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
- `isLoopbackHost()` — —
- `value()` — —
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
- `domainResult()` — —
- `rejectTask()` — —
- `protobuf()` — —
- `diagnostic()` — —
- `currentTaskState()` — —
- `completeTask()` — —
- `protobufResult()` — —
- `intakeDomainResult()` — —
- `record()` — —
- `failTask()` — —
- `agentMessage()` — —
- `listTasks()` — —
- `status()` — —
- `pageSize()` — —
- `includeArtifacts()` — —
- `statusTimestampAfter()` — —
- `filter()` — —
- `filtered()` — —
- `pageCursor()` — —
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
- `executeIntakeAction()` — —
- `requestedRoot()` — —
- `root()` — —
- `projectDir()` — —
- `operation()` — —
- `supplied()` — —
- `envelope()` — —
- `service()` — —
- `result()` — —
- `envelopeInput()` — —
- `encode_envelope(envelope)` — —
- `decode_envelope(data)` — —
- `execute(args)` — —
- `main()` — —
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
- `escapeXml()` — —
- `truncate()` — —
- `sanitizeSourceLine()` — —
- `metricCard()` — —
- `svgStyles()` — —
- `svgDocument()` — —
- `theme()` — —
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
- `raw()` — —
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
- `compactSummaryPayload()` — —
- `referenced()` — —
- `nonAst()` — —
- `moduleAst()` — —
- `relevantAst()` — —
- `ids()` — —
- `selectedRelations()` — —
- `compactRecord()` — —
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
- `MAX_EVENTS()` — —
- `createEventLog()` — —
- `previousDigest()` — —
- `events()` — —
- `renderEventLog()` — —
- `parseEventLog()` — —
- `lines()` — —
- `cursor()` — —
- `exact()` — —
- `field()` — —
- `line()` — —
- `streamId()` — —
- `generatedAt()` — —
- `count()` — —
- `genesisDigest()` — —
- `streamDigest()` — —
- `values()` — —
- `assertEventLog()` — —
- `eventIds()` — —
- `event()` — —
- `calculated()` — —
- `writeEventLogAtomic()` — —
- `content()` — —
- `temporary()` — —
- `runPipeline()` — —
- `execFileAsync()` — —
- `persistPipelineEventLog()` — —
- `manifestPath()` — —
- `manifest()` — —
- `manifestEvidence()` — —
- `identity()` — —
- `events()` — —
- `document()` — —
- `output()` — —
- `canonicalPipelineManifestEvidence()` — —
- `baseEvents()` — —
- `pipelineIdentity()` — —
- `resolvedRoot()` — —
- `git()` — —
- `result()` — —
- `repositoryFromRemote()` — —
- `url()` — —
- `parts()` — —
- `appendDiagnosticEvent()` — —
- `relative()` — —
- `diagnosticsPath()` — —
- `blocking()` — —
- `count()` — —
- `parsed()` — —
- `evidenceError()` — —
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
- `MAX_STAGES()` — —
- `renderAnalysisPolicy()` — —
- `parseAnalysisPolicy()` — —
- `reader()` — —
- `schema()` — —
- `profileId()` — —
- `llmPolicy()` — —
- `cacheMode()` — —
- `onProviderUnavailable()` — —
- `onBudgetExhausted()` — —
- `budget()` — —
- `stageCount()` — —
- `stages()` — —
- `assertAnalysisPolicy()` — —
- `selectAnalysisStages()` — —
- `observed()` — —
- `calculateAnalysisUsageCeiling()` — —
- `analysisPolicyFingerprint()` — —
- `createAnalysisCacheKey()` — —
- `stage()` — —
- `estimateAnalysisCostUsd()` — —
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
- `valueMatchesType()` — —
- `assertBinding()` — —
- `ageSeconds()` — —
- `compileSubactorProcessEnvelope()` — —
- `variableById()` — —
- `referenced()` — —
- `variable()` — —
- `binding()` — —
- `humanApproval()` — —
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
- `variableContractSemanticValue()` — —
- `createVariableContract()` — —
- `normalized()` — —
- `normalizedPlanDraft()` — —
- `operationPlanHashMaterial()` — —
- `createOperationPlan()` — —
- `planHash()` — —
- `argumentsByName()` — —
- `key()` — —
- `value()` — —
- `allowed()` — —
- `unknown()` — —
- `main()` — —
- `args()` — —
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
- `encodeIntakeEnvelope()` — —
- `operation()` — —
- `decodeIntakeEnvelope()` — —
- `values()` — —
- `offset()` — —
- `fieldStart()` — —
- `number()` — —
- `wire()` — —
- `raw()` — —
- `payload()` — —
- `encodeIntakeResult()` — —
- `decodeIntakeResult()` — —
- `strings()` — —
- `numbers()` — —
- `field()` — —
- `bytesField()` — —
- `data()` — —
- `varintField()` — —
- `writeVarint()` — —
- `remaining()` — —
- `readVarint()` — —
- `value()` — —
- `byte()` — —
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
- `loadParticipantIdentityRegistry()` — —
- `v2Path()` — —
- `v1Path()` — —
- `registryPath()` — —
- `normalized()` — —
- `normalizeParticipantIdentityRegistry()` — —
- `registry()` — —
- `participants()` — —
- `ids()` — —
- `principals()` — —
- `key()` — —
- `normalizeV2Entry()` — —
- `kind()` — —
- `assertParticipantIdentityRegistry()` — —
- `external()` — —
- `entry()` — —
- `values()` — —
- `owner()` — —
- `exactKeys()` — —
- `allowed()` — —
- `missing()` — —
- `extra()` — —
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
- `argumentValue()` — —
- `normalizedToken()` — —
- `significant()` — —
- `qualifiedName()` — —
- `sourceExcerpt()` — —
- `addFact()` — —
- `parseFile()` — —
- `root()` — —
- `output()` — —
- `latestPath()` — —
- `latest()` — —
- `manifestPath()` — —
- `manifest()` — —
- `stage()` — —
- `tokens()` — —
- `cost()` — —
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
- `fail()` — —
- `require_command()` — —
- `run_step()` — —
- `root()` — —
- `sourceRoot()` — —
- `files()` — —
- `structuredCalls()` — —
- `source()` — —
- `typescriptFiles()` — —
- `absolute()` — —
- `root()` — —
- `sourceRoot()` — —
- `textExtensions()` — —
- `projectDirectory()` — —
- `changed()` — —
- `original()` — —
- `normalized()` — —
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
- `detect_file_language_with_parser_id(file_path)` — Expose the lowercase tree-sitter ID through the legacy `.name` field.
- `cleanup()` — —
- `parseArguments()` — —
- `values()` — —
- `option()` — —
- `value()` — —
- `optionValue()` — —
- `main()` — —
- `report()` — —
- `message()` — —
- `cleanup()` — —
- `record_sdk_log()` — —
- `run_sdk()` — —
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
- `EVENT_NAMES()` — —
- `parser()` — —
- `values()` — —
- `option()` — —
- `value()` — —
- `asRecord()` — —
- `asText()` — —
- `asString()` — —
- `text()` — —
- `fail()` — —
- `asSha()` — —
- `asTimestamp()` — —
- `asRepository()` — —
- `asTicket()` — —
- `asActor()` — —
- `pickActor()` — —
- `pickTimestamp()` — —
- `canonicalEvidence()` — —
- `pickRepository()` — —
- `repositoryObject()` — —
- `repository()` — —
- `makeCommonEvent()` — —
- `createPushEvents()` — —
- `ref()` — —
- `before()` — —
- `after()` — —
- `deleted()` — —
- `eventTime()` — —
- `occurredAt()` — —
- `actor()` — —
- `commits()` — —
- `sha()` — —
- `commitActor()` — —
- `commitActorId()` — —
- `commitAt()` — —
- `createPullRequestEvents()` — —
- `action()` — —
- `pullRequest()` — —
- `number()` — —
- `baseSha()` — —
- `headSha()` — —
- `createdAt()` — —
- `updatedAt()` — —
- `mergedAt()` — —
- `mapping()` — —
- `createPullRequestReviewEvents()` — —
- `review()` — —
- `reviewId()` — —
- `state()` — —
- `outcome()` — —
- `createWorkflowRunEvents()` — —
- `workflowRun()` — —
- `id()` — —
- `concluded()` — —
- `toEventSet()` — —
- `builder()` — —
- `main()` — —
- `eventPath()` — —
- `raw()` — —
- `ticket()` — —
- `recordedAt()` — —
- `correlationFallback()` — —
- `correlationId()` — —
- `streamId()` — —
- `output()` — —
- `events()` — —
- `generatedAt()` — —
- `document()` — —
- `visited()` — —
- `visit()` — —
- `body()` — —
- `resolved()` — —
- `resolveSource()` — —
- `raw()` — —
- `usage()` — —
- `parseOptions()` — —
- `sortDeep()` — —
- `canonical()` — —
- `sha256Bytes()` — —
- `sha256File()` — —
- `readText()` — —
- `readJson()` — —
- `diagnostic()` — —
- `validatePolicyText()` — —
- `isObject()` — —
- `isSha()` — —
- `isDigest()` — —
- `validateMinimumShape()` — —
- `findNumericScore()` — —
- `globToRegExp()` — —
- `pathAllowed()` — —
- `git()` — —
- `exactStringSet()` — —
- `approvalScopeDigest()` — —
- `expectedVerdict()` — —
- `validateEvaluation()` — —
- `markdownReport()` — —
- `writeResult()` — —
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
- `parse_args()` — —
- `main()` — —
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
- `parse_args()` — —
- `projection_text(record, prefix)` — —
- `main()` — —
- `source_hash(value)` — —
- `dotted_name(node)` — —
- `is_module_entrypoint(node)` — Return true for the canonical ``if __name__ == '__main__'`` guard.
- `iter_python_files(root, files_from)` — —
- `main()` — —
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
- `Generation()` — —
- `Error()` — —
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
- `main()` — —
- `run()` — —
- `envOr()` — —
- `truncate()` — —
- `joinedIDs()` — —
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
- `unwrapTask()` — —
- `main()` — —
- `main()` — —


## Project Structure

📄 `AGENTS`
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
📄 `docs.EVENT_LOG_DSL`
📄 `docs.GROK-PLAN`
📄 `docs.OPTIMIZATION`
📄 `docs.PIPELINE_DSL_NL`
📄 `docs.PROJECT_STATUS`
📄 `docs.PROTOCOLS`
📄 `docs.READINESS`
📄 `docs.README`
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
📄 `dsl-manifest`
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
📄 `goal`
📄 `golang.ast_extract` (15 functions, 3 classes)
📄 `java.JavaAstExtract` (25 functions, 1 classes)
📄 `nlp2uri`
📄 `package`
📄 `php.ast_extract` (7 functions)
📄 `planfile`
📄 `prefact`
📄 `project`
📄 `project2`
📄 `prompts.communication-to-intent.system`
📄 `prompts.docs-to-intent.system`
📄 `prompts.markdown-to-intent.system`
📄 `prompts.nl-to-intent.system`
📄 `prompts.summarize.system`
📄 `prompts.tasks-from-dsl.system`
📄 `pyproject`
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
📄 `scripts.github-event-log` (90 functions)
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
📄 `scripts.runtime` (24 functions)
📄 `scripts.smoke`
📄 `scripts.sync-generated-readme-metadata` (14 functions)
📄 `scripts.vallm-compatible` (1 functions)
📄 `scripts.verify-env-contract` (18 functions)
📄 `scripts.verify-generated-analysis` (15 functions)
📄 `scripts.verify-module-boundaries` (17 functions)
📄 `scripts.verify-no-llm-imports` (6 functions)
📄 `scripts.verify-structured-responses` (7 functions)
📄 `scripts.verify-workflow-yaml` (9 functions)
📄 `scripts.workspace-preflight` (8 functions)
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
📄 `src.cli` (160 functions, 1 classes)
📄 `src.communication.analyzer` (79 functions, 3 classes)
📄 `src.communication.identity` (26 functions, 3 classes)
📄 `src.communication.intake-contract` (44 functions, 7 classes)
📄 `src.communication.intake-protobuf` (24 functions)
📄 `src.communication.intake-service` (82 functions, 2 classes)
📄 `src.communication.intake-store` (19 functions, 3 classes)
📄 `src.communication.llm` (55 functions, 8 classes)
📄 `src.comparison.workspace` (84 functions, 5 classes)
📄 `src.config.env` (27 functions, 1 classes)
📄 `src.core.branch-portfolio` (92 functions, 9 classes)
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
📄 `src.core.truth-map` (81 functions, 5 classes)
📄 `src.core.types` (41 classes)
📄 `src.core.version`
📄 `src.diff.git` (21 functions, 3 classes)
📄 `src.diff.reality` (78 functions, 3 classes)
📄 `src.diff.svg` (7 functions, 2 classes)
📄 `src.diff.text` (53 functions, 1 classes)
📄 `src.diff.text-render` (35 functions, 2 classes)
📄 `src.diff.text-types` (4 classes)
📄 `src.evaluation.analysis-policy` (83 functions, 7 classes)
📄 `src.evaluation.gold` (37 functions, 3 classes)
📄 `src.evaluation.gold-cases` (57 functions, 4 classes)
📄 `src.evaluation.gold-cli` (10 functions)
📄 `src.evaluation.gold-extraction` (14 functions)
📄 `src.evaluation.gold-metrics` (12 functions, 1 classes)
📄 `src.evaluation.gold-types` (11 functions, 15 classes)
📄 `src.extractors.ast` (21 functions, 2 classes)
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
📄 `src.extractors.communication` (97 functions, 6 classes)
📄 `src.extractors.configuration` (44 functions, 2 classes)
📄 `src.extractors.docs-chunks` (29 functions)
📄 `src.extractors.docs-deterministic` (44 functions, 2 classes)
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
📄 `src.extractors.runtime-cycle` (39 functions, 1 classes)
📄 `src.extractors.todo` (18 functions)
📄 `src.graph.capability-evidence` (14 functions)
📄 `src.graph.changelog-signal` (13 functions)
📄 `src.graph.diagnostics` (42 functions)
📄 `src.graph.diff` (38 functions, 1 classes)
📄 `src.graph.linker` (75 functions, 4 classes)
📄 `src.graph.symbol-resolution` (16 functions, 3 classes)
📄 `src.interfaces.a2a` (48 functions)
📄 `src.interfaces.a2a-card` (7 functions)
📄 `src.interfaces.a2a-history` (38 functions, 3 classes)
📄 `src.interfaces.a2a-message` (37 functions)
📄 `src.interfaces.a2a-task-store` (101 functions, 3 classes)
📄 `src.interfaces.a2a-types` (14 functions, 9 classes)
📄 `src.interfaces.governed-intake`
📄 `src.interfaces.intake-actions` (10 functions)
📄 `src.interfaces.intake-schemas.command-v1.schema`
📄 `src.interfaces.intake-schemas.diagnostic-v1.schema`
📄 `src.interfaces.intake-schemas.envelope-v1.schema`
📄 `src.interfaces.intake-schemas.event-v1.schema`
📄 `src.interfaces.intake-schemas.participant-registry-v2.schema`
📄 `src.interfaces.intake-schemas.query-v1.schema`
📄 `src.interfaces.intake-schemas.result-v1.schema`
📄 `src.interfaces.intake_cli` (6 functions)
📄 `src.interfaces.mcp` (43 functions, 2 classes)
📄 `src.interfaces.mcp-errors` (2 functions, 1 classes)
📄 `src.interfaces.mcp-resources` (13 functions)
📄 `src.interfaces.mcp-tools` (10 functions, 1 classes)
📄 `src.live.contract-check` (39 functions, 6 classes)
📄 `src.live.model-comparison` (21 functions, 4 classes)
📄 `src.llm.audit` (4 functions)
📄 `src.llm.failure` (3 functions, 1 classes)
📄 `src.llm.openrouter` (79 functions, 8 classes)
📄 `src.llm.openrouter-timeout` (19 functions, 2 classes)
📄 `src.llm.structured-schema` (37 functions, 5 classes)
📄 `src.llm.subllm` (51 functions, 2 classes)
📄 `src.operations.artifact` (10 functions, 2 classes)
📄 `src.operations.compile-cli` (7 functions)
📄 `src.operations.contract` (8 functions)
📄 `src.operations.subactor` (10 functions, 1 classes)
📄 `src.operations.types` (8 classes)
📄 `src.operations.validation` (47 functions)
📄 `src.pipeline.event-log` (62 functions, 4 classes)
📄 `src.pipeline.event-log-persistence` (25 functions)
📄 `src.pipeline.run` (82 functions, 8 classes)
📄 `src.sdk.typescript` (16 functions, 6 classes)
📄 `src.semantic.reranker` (40 functions, 11 classes)
📄 `src.semantic.reranker-llm` (29 functions, 2 classes)
📄 `src.semantic.reranker-response` (5 functions, 1 classes)
📄 `src.services.actions` (113 functions)
📄 `src.services.branch-portfolio-assembler` (54 functions, 4 classes)
📄 `src.services.branch-snapshot` (92 functions, 9 classes)
📄 `src.services.workspace-preflight` (96 functions, 12 classes)
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
📄 `testql-scenarios.generated-cli-tests.testql.toon`
📄 `tsconfig`

## Requirements

- typescript >=5.8.3 <7

## Contributing

**Contributors:**
- Tom Softreck <tom@sapletta.com>
- Tom Sapletta <tom-sapletta-com@users.noreply.github.com>
- ifuri-validator-agent[bot] <307050737+ifuri-validator-agent[bot]@users.noreply.github.com>
- Mateusz Lewandowski <matlew2003@gmail.com>

We welcome contributions! Open an issue or pull request to get started.
### Development Setup

```bash
# Clone the repository
git clone https://github.com/autogrammar/todo2code
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