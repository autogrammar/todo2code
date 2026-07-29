// DOM rendering for the divergence panel. No frontend framework is used, which
// keeps the AST extractor on plain TypeScript declarations.

import type { IntentEvent } from './api.js';

export type DivergenceStatus = 'aligned' | 'planned_not_implemented' | 'implemented_not_planned';

export interface PanelRow {
  event: IntentEvent;
  status: DivergenceStatus;
}

export function classifyEvent(event: IntentEvent): DivergenceStatus {
  if (event.action === 'document') return 'implemented_not_planned';
  if (event.action === 'add' || event.action === 'fix') return 'planned_not_implemented';
  return 'aligned';
}

export function toRows(events: IntentEvent[]): PanelRow[] {
  return events.map((event) => ({ event, status: classifyEvent(event) }));
}

export function renderTable(container: HTMLElement, rows: PanelRow[]): void {
  container.replaceChildren();

  const table = document.createElement('table');
  const head = document.createElement('thead');
  head.appendChild(headerRow(['Event', 'Agent', 'Action', 'Object', 'Status']));
  table.appendChild(head);

  const body = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.dataset.status = row.status;
    for (const value of [row.event.id, row.event.agent, row.event.action, row.event.object, row.status]) {
      const cell = document.createElement('td');
      cell.textContent = value;
      tr.appendChild(cell);
    }
    body.appendChild(tr);
  }
  table.appendChild(body);
  container.appendChild(table);
}

export function renderError(container: HTMLElement, message: string): void {
  container.replaceChildren();
  const banner = document.createElement('p');
  banner.className = 'error';
  banner.setAttribute('role', 'alert');
  banner.textContent = message;
  container.appendChild(banner);
}

function headerRow(labels: string[]): HTMLTableRowElement {
  const tr = document.createElement('tr');
  for (const label of labels) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = label;
    tr.appendChild(th);
  }
  return tr;
}
