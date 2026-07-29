// Browser HTTP client for the example panel.
//
// Retry-on-network-error is still open in TODO.md, so the reality view reports
// this file as planned-but-not-fully-implemented on purpose.

export interface IntentEvent {
  id: string;
  agent: string;
  action: string;
  object: string;
  receivedAt: string;
}

export interface EventPage {
  events: IntentEvent[];
  total: number;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function fetchEvents(baseUrl: string, offset = 0, limit = 50): Promise<EventPage> {
  const url = new URL('/events', baseUrl);
  url.searchParams.set('offset', String(offset));
  url.searchParams.set('limit', String(limit));

  const response = await fetch(url.toString(), { headers: { accept: 'application/json' } });
  if (!response.ok) throw new ApiError(`GET /events failed with ${response.status}`, response.status);

  const payload = await response.json() as Partial<EventPage>;
  return {
    events: Array.isArray(payload.events) ? payload.events : [],
    total: typeof payload.total === 'number' ? payload.total : 0,
  };
}

export async function publishEvent(baseUrl: string, event: Omit<IntentEvent, 'id' | 'receivedAt'>): Promise<string> {
  const response = await fetch(new URL('/events', baseUrl).toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
  });
  const payload = await response.json() as { id?: string; error?: string };
  if (!response.ok) throw new ApiError(payload.error ?? `POST /events failed with ${response.status}`, response.status);
  return payload.id ?? '';
}
