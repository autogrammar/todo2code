// In-memory event store for the example backend.
//
// The persistent variant is still listed as open in TODO.md, so `t2c reality`
// reports this file as planned-but-not-fully-implemented on purpose.

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

export class EventStore {
  private readonly events: IntentEvent[] = [];

  private sequence = 0;

  enqueueEvent(agent: string, action: string, object: string, now = new Date()): IntentEvent {
    this.sequence += 1;
    const event: IntentEvent = {
      id: `EVT-${String(this.sequence).padStart(6, '0')}`,
      agent,
      action,
      object,
      receivedAt: now.toISOString(),
    };
    this.events.push(event);
    return event;
  }

  listEvents(offset = 0, limit = 50): EventPage {
    const start = Math.max(0, offset);
    return {
      events: this.events.slice(start, start + Math.max(1, limit)),
      total: this.events.length,
    };
  }

  size(): number {
    return this.events.length;
  }
}
