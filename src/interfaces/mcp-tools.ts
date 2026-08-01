import type { T2CConfig } from '../config/env.js';
import { executeAction, type T2CAction } from '../services/actions.js';
import { executeIntakeAction, type IntakeAction } from './intake-actions.js';
import { McpRequestError } from './mcp-errors.js';

interface McpTool {
  name: T2CAction | IntakeAction;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

export const MCP_TOOLS: McpTool[] = [
  tool('intake_command', 'Execute one role-bound trusted-intake command through the shared CQRS handler.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    projectDir: stringProp('Governance directory, default project.'),
    envelope: { type: 'object', description: 'Strict t2c.intake-envelope/v1 command envelope.' },
    protobuf: stringProp('Optional base64 canonical Protobuf envelope.'),
  }),
  tool('intake_query', 'Execute one read-only governed-intake query through the shared CQRS handler.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    projectDir: stringProp('Governance directory, default project.'),
    envelope: { type: 'object', description: 'Strict t2c.intake-envelope/v1 query envelope.' },
    protobuf: stringProp('Optional base64 canonical Protobuf envelope.'),
  }),
  tool('extract_nl', 'Extract NL/task text to canonical Intent DSL through audited LLM generation with a deterministic fallback.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    file: stringProp('Source file path. Defaults to TASK.md.'),
    text: stringProp('Optional inline text. When present, file is used only as source identity.'),
    nlMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
  }),
  tool('extract_git', 'Extract the last N Git commits to Intent DSL without an LLM.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    count: numberProp('Number of commits, default 10.', 1, 100),
  }),
  tool('extract_ast', 'Extract TypeScript/JavaScript, Python, Go, Java and Rust AST facts to Intent DSL without an LLM.', {
    root: stringProp('Repository root under T2C_ROOT.'),
  }),
  tool('extract_config', 'Extract repository configuration, Docker and CI declarations to Intent DSL without an LLM.', {
    root: stringProp('Repository root under T2C_ROOT.'),
  }),
  tool('extract_markdown', 'Extract TODO.md and CHANGELOG.md structurally, with audited LLM semantic enrichment and deterministic fallback.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    todo: nullableStringProp('TODO path or null.'),
    changelog: nullableStringProp('CHANGELOG path or null.'),
    markdownMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
  }),
  tool('extract_docs', 'Extract documentation to Intent DSL through OpenRouter structured outputs.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    patterns: stringArrayProp('Documentation glob patterns.'),
    excludes: stringArrayProp('Exclusion glob patterns.'),
  }),
  tool('extract_communication', 'Extract per-ticket human and agent communication under project/<ticket>/ to canonical Intent DSL.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    projectDir: stringProp('Communication root, default project.'),
    ticket: nullableStringProp('Optional ticket filter.'),
    communicationMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
  }),
  tool('analyze_communication', 'Analyze every human/agent separately and detect communication-to-work divergences.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    projectDir: stringProp('Communication root, default project.'),
    ticket: nullableStringProp('Optional ticket filter.'),
    communicationMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
    graph: { type: 'object', description: 'Optional existing t2c.graph/v1 object.' },
    gitCount: numberProp('Commit evidence count, default 10.', 1, 100),
    includeAst: { type: 'boolean', description: 'Include AST evidence, default true.' },
    includeGraph: { type: 'boolean', description: 'Include the constructed graph in the result.' },
  }),
  tool('link', 'Link Intent DSL records into a deterministic evidence graph.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    records: { type: 'array', items: { type: 'object' } },
    files: stringArrayProp('Alternative list of JSONL paths.'),
  }),
  tool('diagnose', 'Run deterministic alignment diagnostics on an Intent graph.', {
    graph: { type: 'object', description: 't2c.graph/v1 object.' },
  }, ['graph']),
  tool('summarize', 'Generate grounded Polish NL summary from graph and diagnostics through OpenRouter.', {
    graph: { type: 'object' },
    diagnostics: { type: 'object' },
    mode: stringProp('deterministic, prefer-llm or require-llm (default).'),
    fallback: { type: 'boolean', description: 'Deprecated alias: true selects prefer-llm, false selects require-llm.' },
  }, ['graph']),
  tool('diff', 'Compare two Intent graphs and return canonical t2c.diff/v1 JSON plus an SVG view.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    beforeGraph: { type: 'object', description: 'Earlier t2c.graph/v1 object.' },
    afterGraph: { type: 'object', description: 'Later t2c.graph/v1 object.' },
    before: stringProp('Alternative earlier graph path under root.'),
    after: stringProp('Alternative later graph path under root.'),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
    maxItems: numberProp('Maximum rows per SVG section, default 18.', 1, 100),
    communicationOnly: { type: 'boolean', description: 'Compare only versioned agent_log communication records.' },
    participant: stringProp('Optional exact communication participant filter.'),
    role: stringProp('Optional human, agent or unknown communication role filter.'),
    ticket: stringProp('Optional ticket filter applied to both graphs.'),
  }),
  tool('diff_files', 'Diff two files with the deterministic Myers engine and return unified text plus an SVG view.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    before: stringProp('Earlier file path under root.'),
    after: stringProp('Later file path under root.'),
    path: stringProp('Display path for the rendered diff.'),
    context: numberProp('Unchanged context lines per hunk, default 3.', 0, 100),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
    includeHtml: { type: 'boolean', description: 'Include HTML visualization, default false.' },
    maxRows: numberProp('Maximum rendered SVG rows, default 400.', 1, 4000),
  }, ['before', 'after']),
  tool('diff_git', 'Diff the Git work tree or index against a revision and render it.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    revision: stringProp('Base revision, default HEAD.'),
    staged: { type: 'boolean', description: 'Compare the index instead of the work tree.' },
    context: numberProp('Unchanged context lines per hunk, default 3.', 0, 100),
    maxFiles: numberProp('Maximum files inspected, default 50.', 1, 500),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
    includeHtml: { type: 'boolean', description: 'Include HTML visualization, default false.' },
  }),
  tool('reality', 'Compare declared intent against observed code and return the t2c.reality/v1 view.', {
    graph: { type: 'object', description: 't2c.graph/v1 object.' },
    diagnostics: { type: 'object', description: 'Optional t2c.diagnostics/v1 report; recomputed when absent.' },
    gapsOnly: { type: 'boolean', description: 'Render only divergent topics.' },
    maxRows: numberProp('Maximum rendered rows, default 30.', 1, 500),
    includeSvg: { type: 'boolean', description: 'Include SVG visualization, default true.' },
  }, ['graph']),
  tool('compare_workspace', 'Compare intent at a Git base ref (default origin/main) with committed and uncommitted workspace state.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    base: stringProp('Git base ref, default origin/main.'),
    task: nullableStringProp('NL task file included on each side when present.'),
    todo: nullableStringProp('TODO file.'),
    changelog: nullableStringProp('CHANGELOG file.'),
    docs: stringArrayProp('Documentation patterns.'),
    docExcludes: stringArrayProp('Documentation exclusion patterns.'),
    markdownMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
    communicationMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
    includeDocsLlm: { type: 'boolean', description: 'Run the same LLM documentation extraction on both sides.' },
    output: stringProp('Comparison artifact root, default .intent.'),
    gitCount: numberProp('Number of commit claims included per side.', 1, 100),
  }),
  tool('propose_todo', 'Synthesize grounded TODO proposals from a graph and diagnostics with an audited LLM mode.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    graph: { type: 'object', description: 'Inline t2c.graph/v1 object.' },
    graphPath: stringProp('Alternative graph JSON path under root.'),
    diagnostics: { type: 'object', description: 'Inline t2c.diagnostics/v1 report; derived when omitted.' },
    diagnosticsPath: stringProp('Alternative diagnostics JSON path under root.'),
    mode: stringProp('prefer-llm or require-llm (default).'),
    output: stringProp('Optional synthesis JSON output path under root.'),
  }),
  tool('render_todo', 'Render validated new proposals to a reviewable TODO.patch and adjacent JSON audit without changing TODO.md.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    graph: { type: 'object', description: 'Inline t2c.graph/v1 object.' },
    graphPath: stringProp('Alternative graph JSON path under root.'),
    diagnostics: { type: 'object', description: 'Inline t2c.diagnostics/v1 report.' },
    diagnosticsPath: stringProp('Alternative diagnostics JSON path under root.'),
    synthesis: { type: 'object', description: 'Inline t2c.task-synthesis/v1 result.' },
    synthesisPath: stringProp('Alternative synthesis JSON path under root.'),
    todo: stringProp('Source TODO path, default TODO.md.'),
    patch: stringProp('Review Markdown output path, default TODO.patch.'),
    audit: stringProp('Patch audit JSON output path, default TODO.patch.json.'),
  }),
  tool('apply_todo', 'Apply one explicitly approved, unchanged TODO patch atomically and write an idempotency receipt.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    todo: stringProp('Source TODO path, default TODO.md.'),
    patch: stringProp('Reviewed TODO.patch path.'),
    audit: stringProp('TODO patch audit JSON path.'),
    receipt: stringProp('Apply receipt output path.'),
    actor: stringProp('Human approving actor identity.'),
    approvalHash: stringProp('Exact renderedPatchHash approved by the actor.'),
  }, ['patch', 'audit', 'receipt', 'actor', 'approvalHash']),
  tool('propose_code_change', 'Build grounded t2c.code-change-plan/v1 proposals from open implementation diagnostics without applying code.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    graph: { type: 'object', description: 'Inline t2c.graph/v1 object.' },
    graphPath: stringProp('Alternative graph JSON path under root.'),
    diagnostics: { type: 'object', description: 'Inline t2c.diagnostics/v1 report; derived when omitted.' },
    diagnosticsPath: stringProp('Alternative diagnostics JSON path under root.'),
    conclusions: { type: 'object', description: 'Optional conclusions array used as evidence references.' },
    conclusionsPath: stringProp('Optional conclusions JSON path under root.'),
    proposals: { type: 'object', description: 'Optional TODO proposals used to enrich target paths/symbols.' },
    proposalsPath: stringProp('Optional proposals JSON path under root.'),
    maxPlans: numberProp('Maximum plans to materialise, default 50.', 1, 500),
    output: stringProp('Optional plan-set JSON output path under root.'),
  }),
  tool('render_code_change', 'Render a hash-bound CODE_CHANGE.review.md brief from a code-change plan set without applying source edits.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    plans: { type: 'object', description: 'Inline t2c.code-change-plan-set/v1 object.' },
    plansPath: stringProp('Alternative plan-set JSON path under root.'),
    patch: stringProp('Markdown review output path, default CODE_CHANGE.review.md.'),
    audit: stringProp('Review audit JSON path, default CODE_CHANGE.review.json.'),
  }),
  tool('propose_source_patch', 'Build structured t2c.code-change-source-patch/v1 edit proposals from a plan or plan set without applying them.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    plan: { type: 'object', description: 'Inline t2c.code-change-plan/v1 object.' },
    planPath: stringProp('Single plan JSON path under root.'),
    plans: { type: 'object', description: 'Inline t2c.code-change-plan-set/v1 object.' },
    plansPath: stringProp('Plan-set JSON path under root.'),
    unifiedDiffs: { type: 'object', description: 'Optional path→unifiedDiff map for a single plan.' },
    output: stringProp('Optional JSON output path under root.'),
  }),
  tool('apply_source_patch', 'Apply a fully-diffed source patch after explicit actor + patchHash approval. Instruction-only edits are rejected.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    patch: { type: 'object', description: 'Inline t2c.code-change-source-patch/v1 object.' },
    patchPath: stringProp('Source patch JSON path under root.'),
    actor: stringProp('Human approving actor identity.'),
    approvalHash: stringProp('Exact patchHash approved by the actor.'),
    receipt: stringProp('Apply receipt output path, default CODE_CHANGE.source.receipt.json.'),
  }, ['actor', 'approvalHash']),
  tool('close_code_change', 'Evaluate one plan or a whole plan set against before/after graphs and return aggregate acceptance without marking DONE.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    input: { type: 'object', description: 'Inline plan or plan-set object; schemaVersion selects the shape.' },
    inputPath: stringProp('Plan or plan-set JSON path under root; schemaVersion selects the shape.'),
    plan: { type: 'object', description: 'Inline t2c.code-change-plan/v1 object.' },
    planPath: stringProp('Single plan JSON path under root.'),
    plans: { type: 'object', description: 'Inline t2c.code-change-plan-set/v1 object.' },
    plansPath: stringProp('Plan-set JSON path under root.'),
    beforeGraph: { type: 'object', description: 'Graph the plan was grounded on.' },
    beforeGraphPath: stringProp('Before graph JSON path under root.'),
    beforeDiagnostics: { type: 'object', description: 'Before diagnostics; derived when omitted.' },
    beforeDiagnosticsPath: stringProp('Before diagnostics JSON path under root.'),
    afterGraph: { type: 'object', description: 'Graph after an attempted implementation.' },
    afterGraphPath: stringProp('After graph JSON path under root.'),
    afterDiagnostics: { type: 'object', description: 'After diagnostics; derived when omitted.' },
    afterDiagnosticsPath: stringProp('After diagnostics JSON path under root.'),
    output: stringProp('Optional close-result JSON output path under root.'),
  }),
  tool('evaluate_code_change', 'Re-diagnose an after graph and decide whether a code-change plan cleared its targeted diagnostics.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    plan: { type: 'object', description: 'Inline t2c.code-change-plan/v1 object.' },
    planPath: stringProp('Alternative plan JSON path under root.'),
    beforeGraph: { type: 'object', description: 'Graph the plan was grounded on.' },
    beforeGraphPath: stringProp('Before graph JSON path under root.'),
    beforeDiagnostics: { type: 'object', description: 'Before diagnostics; derived when omitted.' },
    beforeDiagnosticsPath: stringProp('Before diagnostics JSON path under root.'),
    afterGraph: { type: 'object', description: 'Graph after an attempted implementation.' },
    afterGraphPath: stringProp('After graph JSON path under root.'),
    afterDiagnostics: { type: 'object', description: 'After diagnostics; derived when omitted.' },
    afterDiagnosticsPath: stringProp('After diagnostics JSON path under root.'),
    output: stringProp('Optional acceptance JSON output path under root.'),
  }),
  tool('pipeline', 'Run the complete todo2code pipeline and write a versioned .intent run.', {
    root: stringProp('Repository root under T2C_ROOT.'),
    task: nullableStringProp('NL task/ticket file.'),
    todo: nullableStringProp('TODO file.'),
    changelog: nullableStringProp('CHANGELOG file.'),
    docs: stringArrayProp('Documentation glob patterns.'),
    docExcludes: stringArrayProp('Documentation exclusion patterns; override to include one historical .intent report.'),
    nlMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
    markdownMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
    includeDocsLlm: { type: 'boolean' },
    output: stringProp('Output directory, default .intent.'),
    gitCount: numberProp('Number of commits, default 10.', 1, 100),
    summaryFallback: { type: 'boolean' },
    includeSummaryLlm: { type: 'boolean', description: 'Use the configured LLM for the final summary; false is fully deterministic.' },
    taskMode: stringProp('disabled (default), prefer-llm or require-llm task synthesis and TODO.patch rendering.'),
    includeCommunication: { type: 'boolean', description: 'Analyze project/<ticket> communication in the main run; default true.' },
    projectDir: stringProp('Communication directory under root, default project.'),
    communicationTicket: nullableStringProp('Optional ticket filter for communication input.'),
    communicationMode: stringProp('deterministic, prefer-llm or require-llm (default).'),
  }),
];

export async function callMcpTool(
  params: Record<string, unknown>,
  config: T2CConfig,
): Promise<Record<string, unknown>> {
  const name = params.name;
  if (typeof name !== 'string' || !MCP_TOOLS.some((item) => item.name === name)) {
    throw new McpRequestError(-32602, `Unknown tool: ${String(name)}`);
  }
  const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments)
    ? params.arguments as Record<string, unknown>
    : {};
  try {
    const result = name === 'intake_command' || name === 'intake_query'
      ? await executeIntakeAction(name, args, config)
      : await executeAction(name as T2CAction, args, config);
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      structuredContent: result,
      isError: false,
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
      isError: true,
    };
  }
}

function tool(
  name: T2CAction | IntakeAction,
  description: string,
  properties: Record<string, unknown>,
  required: string[] = [],
): McpTool {
  const writes = new Set<T2CAction | IntakeAction>([
    'intake_command',
    'pipeline', 'propose_todo', 'render_todo', 'apply_todo',
    'propose_code_change', 'render_code_change', 'propose_source_patch', 'apply_source_patch',
    'evaluate_code_change', 'close_code_change',
  ]);
  return {
    name,
    description,
    inputSchema: { type: 'object', additionalProperties: false, properties, required },
    annotations: {
      readOnlyHint: !writes.has(name),
      destructiveHint: name === 'apply_todo' || name === 'apply_source_patch',
      idempotentHint: name !== 'pipeline' && name !== 'propose_todo',
    },
  };
}

function stringProp(description: string): Record<string, unknown> {
  return { type: 'string', description };
}

function nullableStringProp(description: string): Record<string, unknown> {
  return { type: ['string', 'null'], description };
}

function stringArrayProp(description: string): Record<string, unknown> {
  return { type: 'array', items: { type: 'string' }, description };
}

function numberProp(description: string, minimum: number, maximum: number): Record<string, unknown> {
  return { type: 'integer', minimum, maximum, description };
}
