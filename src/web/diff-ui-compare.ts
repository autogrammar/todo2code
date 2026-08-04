export const DIFF_UI_COMPARE_SCRIPT = `
function comparisonPayloadFromInputs() {
  const beforePath = byId('before-run').value || byId('before-path').value.trim();
  const afterPath = byId('after-run').value || byId('after-path').value.trim();
  if (beforePath && afterPath) {
    return { beforePath, afterPath, includeSvg: true, compact: true };
  }

  const beforeGraphText = byId('before').value.trim();
  const afterGraphText = byId('after').value.trim();
  if (!beforeGraphText || !afterGraphText) {
    throw new Error('Wybierz dwa runy albo podaj oba grafy ręcznie.');
  }

  return {
    beforeGraph: JSON.parse(beforeGraphText),
    afterGraph: JSON.parse(afterGraphText),
    includeSvg: true,
    compact: true,
  };
}

function comparisonFilters() {
  const filters = {};
  for (const [key, id] of [
    ['participant', 'participant-filter'],
    ['role', 'role-filter'],
    ['ticket', 'ticket-filter'],
  ]) {
    const value = byId(id).value.trim();
    if (value) {
      filters[key] = value;
    }
  }
  return filters;
}

function formatComparisonSummary(summary) {
  return [
    ['Rekordy +', summary.recordsAdded],
    ['Rekordy −', summary.recordsRemoved],
    ['Zmienione', summary.recordsChanged],
    ['Relacje +', summary.relationsAdded],
    ['Relacje −', summary.relationsRemoved],
  ]
    .map(([label, value]) => '<div class="metric"><b>' + value + '</b><span>' + label + '</span></div>')
    .join('');
}

function renderComparisonResponse(responsePayload) {
  const summary = responsePayload.diff.summary;
  byId('metrics').innerHTML = formatComparisonSummary(summary);
  byId('svg-host').innerHTML = responsePayload.svg;
  byId('fingerprint').textContent = 'diff fingerprint: ' + responsePayload.diff.fingerprint;
  byId('result').classList.add('visible');
}

async function loadComparisonPayload() {
  const payload = comparisonPayloadFromInputs();
  const filters = comparisonFilters();
  for (const [key, value] of Object.entries(filters)) {
    payload[key] = value;
  }

  if (payload.participant || payload.role) {
    payload.communicationOnly = true;
  }

  const response = await fetch('/api/diff', {
    method: 'POST',
    headers: requestHeaders(true),
    body: JSON.stringify(payload),
  });

  const responsePayload = await response.json();
  if (!response.ok) {
    throw new Error(typeof responsePayload.error === 'string' ? responsePayload.error : 'HTTP ' + response.status);
  }

  return responsePayload;
}

async function compareGraphs() {
  const button = byId('compare');
  const status = byId('status');
  const error = byId('error');
  const result = byId('result');

  button.disabled = true;
  status.textContent = 'Obliczanie diffu…';
  error.textContent = '';
  result.classList.remove('visible');

  try {
    const responsePayload = await loadComparisonPayload();
    renderComparisonResponse(responsePayload);
    status.textContent = 'Porównanie gotowe';
  } catch (cause) {
    error.textContent = cause instanceof Error ? cause.message : String(cause);
    status.textContent = 'Porównanie nie powiodło się';
  } finally {
    button.disabled = false;
  }
}
`;
