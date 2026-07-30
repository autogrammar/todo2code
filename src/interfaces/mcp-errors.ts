export class McpRequestError extends Error {
  constructor(readonly code: number, message: string, readonly data?: unknown) {
    super(message);
  }
}

export function normalizeMcpError(error: unknown): McpRequestError {
  if (error instanceof McpRequestError) return error;
  return new McpRequestError(-32603, error instanceof Error ? error.message : String(error));
}
