/**
 * Apply the user-facing LLM-first defaults before MCP/A2A requests enter the
 * programmatic service layer. Explicit values always win.
 */
export function withLlmFirstInterfaceDefaults(
  action: string,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (action === 'pipeline' && input.taskMode === undefined) {
    return {
      ...input,
      taskMode: isExplicitOfflinePipeline(input) ? 'disabled' : 'require-llm',
    };
  }
  if (action === 'compare_workspace' && input.includeDocsLlm === undefined) {
    return { ...input, includeDocsLlm: true };
  }
  return input;
}

function isExplicitOfflinePipeline(input: Record<string, unknown>): boolean {
  return input.includeDocsLlm === false
    && input.includeSummaryLlm === false
    && input.nlMode === 'deterministic'
    && input.markdownMode === 'deterministic';
}
