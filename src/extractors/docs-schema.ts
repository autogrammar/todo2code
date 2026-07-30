export function documentResponseSchema(maxRecords: number): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['records'],
    properties: {
      records: {
        type: 'array',
        maxItems: maxRecords,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['kind', 'actor', 'action', 'subject', 'object', 'modality', 'polarity', 'lifecycle', 'confidence', 'basis', 'target', 'sourceLines', 'text'],
          properties: {
            kind: { type: 'string' },
            actor: { type: ['string', 'null'] },
            action: {
              type: 'string',
              enum: ['add', 'fix', 'remove', 'refactor', 'test', 'document', 'configure', 'analyze', 'validate', 'call', 'depend_on', 'declare', 'release', 'change', 'preserve', 'block', 'approve', 'unknown'],
            },
            subject: { type: ['string', 'null'] },
            object: { type: 'string' },
            modality: {
              type: 'string',
              enum: ['required', 'recommended', 'optional', 'observed', 'claimed', 'unknown'],
            },
            polarity: { type: 'string', enum: ['positive', 'negative'] },
            lifecycle: {
              type: 'string',
              enum: ['proposed', 'planned', 'in_progress', 'implemented', 'verified', 'released', 'completed', 'blocked', 'unknown'],
            },
            confidence: { type: 'number', minimum: 0, maximum: 0.85 },
            basis: { type: 'array', items: { type: 'string' } },
            target: {
              type: 'object',
              additionalProperties: false,
              required: ['paths', 'symbols', 'tickets', 'versions'],
              properties: {
                paths: { type: 'array', items: { type: 'string' } },
                symbols: { type: 'array', items: { type: 'string' } },
                tickets: { type: 'array', items: { type: 'string' } },
                versions: { type: 'array', items: { type: 'string' } },
              },
            },
            sourceLines: {
              type: 'object',
              additionalProperties: false,
              required: ['start', 'end'],
              properties: {
                start: { type: 'integer', minimum: 1 },
                end: { type: 'integer', minimum: 1 },
              },
            },
            text: { type: 'string' },
          },
        },
      },
    },
  };
}
