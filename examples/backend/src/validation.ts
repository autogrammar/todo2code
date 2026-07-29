// Payload validation applied before anything reaches the store.

export interface ValidationResult {
  valid: boolean;
  reason: string | null;
  agent: string;
  action: string;
  object: string;
}

const ALLOWED_ACTIONS = new Set(['add', 'fix', 'remove', 'refactor', 'test', 'document']);

export function validateEventPayload(payload: unknown): ValidationResult {
  const invalid = (reason: string): ValidationResult => ({
    valid: false, reason, agent: '', action: '', object: '',
  });

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return invalid('payload must be a JSON object');
  }
  const record = payload as Record<string, unknown>;
  const agent = typeof record.agent === 'string' ? record.agent.trim() : '';
  const action = typeof record.action === 'string' ? record.action.trim() : '';
  const object = typeof record.object === 'string' ? record.object.trim() : '';

  if (!agent) return invalid('agent is required');
  if (!ALLOWED_ACTIONS.has(action)) return invalid(`action must be one of ${[...ALLOWED_ACTIONS].join(', ')}`);
  if (!object) return invalid('object is required');

  return { valid: true, reason: null, agent, action, object };
}
