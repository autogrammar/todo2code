// View state and mounting for the divergence panel.

import { ApiError, fetchEvents, type IntentEvent } from './api.js';
import { renderError, renderTable, toRows } from './render.js';

export interface PanelState {
  baseUrl: string;
  events: IntentEvent[];
  total: number;
  loading: boolean;
  error: string | null;
}

export function createState(baseUrl: string): PanelState {
  return { baseUrl, events: [], total: 0, loading: false, error: null };
}

export async function refresh(state: PanelState, container: HTMLElement): Promise<PanelState> {
  const pending: PanelState = { ...state, loading: true, error: null };
  try {
    const page = await fetchEvents(pending.baseUrl);
    const next: PanelState = { ...pending, events: page.events, total: page.total, loading: false };
    renderTable(container, toRows(next.events));
    return next;
  } catch (error) {
    // The acceptance criteria require the user to see network failures, not just
    // the console, so the message is rendered into the panel.
    const message = error instanceof ApiError
      ? `Nie udało się pobrać zdarzeń (HTTP ${error.status}).`
      : `Nie udało się pobrać zdarzeń: ${error instanceof Error ? error.message : String(error)}`;
    renderError(container, message);
    return { ...pending, loading: false, error: message };
  }
}

export function mountPanel(container: HTMLElement, baseUrl: string): { state: PanelState; reload: () => Promise<void> } {
  let state = createState(baseUrl);
  const reload = async (): Promise<void> => {
    state = await refresh(state, container);
  };
  void reload();
  return { get state() { return state; }, reload };
}
