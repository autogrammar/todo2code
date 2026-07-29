import type { IntentAction, Modality, Polarity } from './types.js';

const ACTION_PATTERNS: Array<[IntentAction, RegExp]> = [
  ['remove', /\b(remove|delete|drop|usun(?:ąć|ac)|wycofa(?:ć|c)|likwidowa(?:ć|c))\b/i],
  ['fix', /\b(fix|repair|correct|napraw(?:ić|ic)|popraw(?:ić|ic)|bug)\b/i],
  ['refactor', /\b(refactor|restructure|reorganiz|przebudowa(?:ć|c)|refaktoryz)/i],
  ['test', /\b(test|spec|coverage|przetestowa(?:ć|c)|testowa(?:ć|c))\b/i],
  ['document', /\b(document|docs|readme|changelog|udokumentowa(?:ć|c)|dokumentacj)/i],
  ['configure', /\b(configur|setup|ustawi(?:ć|c)|konfigur)/i],
  ['validate', /\b(validat|verify|check|walid|sprawdzi(?:ć|c)|zweryfikowa(?:ć|c))\b/i],
  ['analyze', /\b(analy[sz]|inspect|scan|analiz|zbada(?:ć|c))\b/i],
  ['block', /\b(block|deny|prevent|zablokowa(?:ć|c)|zabroni(?:ć|c))\b/i],
  ['approve', /\b(approve|accept|zatwierdzi(?:ć|c)|zaakceptowa(?:ć|c))\b/i],
  ['add', /\b(add|create|implement|introduce|build|utworzy(?:ć|c)|doda(?:ć|c)|zaimplementowa(?:ć|c)|stworzy(?:ć|c)|zbudowa(?:ć|c))\b/i],
  ['change', /\b(change|update|modify|zmieni(?:ć|c)|aktualizowa(?:ć|c)|modyfikowa(?:ć|c))\b/i],
  ['preserve', /\b(preserve|keep|maintain|zachowa(?:ć|c)|utrzyma(?:ć|c))\b/i],
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with', 'from', 'by',
  'i', 'oraz', 'lub', 'do', 'z', 'ze', 'na', 'w', 'we', 'dla', 'przez', 'się', 'ma',
  'musi', 'powinien', 'powinna', 'powinno', 'należy', 'trzeba', 'może', 'system', 'agent',
]);

export function classifyActionHeuristically(text: string): IntentAction {
  const conventional = text.match(/^\s*(feat|fix|refactor|test|docs|chore|build|ci|perf)(?:\([^)]*\))?!?:/i)?.[1]?.toLowerCase();
  if (conventional === 'feat') return 'add';
  if (conventional === 'fix') return 'fix';
  if (conventional === 'refactor' || conventional === 'perf') return 'refactor';
  if (conventional === 'test') return 'test';
  if (conventional === 'docs') return 'document';
  if (conventional === 'build' || conventional === 'ci' || conventional === 'chore') return 'configure';
  // Fold diacritics before dictionary matching. JavaScript's `\b` treats letters such
  // as `ć` or `ą` as non-word characters, so matching only the raw Polish text
  // would miss perfectly valid imperatives such as `dodać`.
  const searchable = normalizeToken(text);
  for (const [action, pattern] of ACTION_PATTERNS) {
    if (pattern.test(text) || pattern.test(searchable)) return action;
  }
  return 'unknown';
}

export function detectModality(text: string): Modality {
  if (/\b(must|required|shall|musi|muszą|należy|trzeba|wymaga)\b/i.test(text)) return 'required';
  if (/\b(should|recommended|powinien|powinna|powinno|zaleca)\b/i.test(text)) return 'recommended';
  if (/\b(may|optional|can|może|opcjonaln)\b/i.test(text)) return 'optional';
  return 'unknown';
}

export function detectPolarity(text: string): Polarity {
  return /\b(no|not|never|without|nie|bez|zakaz|zabronion)\b/i.test(text) ? 'negative' : 'positive';
}

export function normalizeToken(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[łŁ]/g, 'l')
    .toLowerCase()
    .replace(/[`'"()[\]{}<>]/g, ' ')
    .replace(/[^a-z0-9_./#-]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function keywords(value: string): string[] {
  return [...new Set(normalizeToken(value).split(' ').filter((token) => token.length > 1 && !STOP_WORDS.has(token)))].sort();
}

export function similarity(a: string, b: string): number {
  const left = new Set(keywords(a));
  const right = new Set(keywords(b));
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const item of left) {
    if (right.has(item)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

export function extractBacktickValues(text: string): string[] {
  const values: string[] = [];
  for (const match of text.matchAll(/`([^`]+)`/g)) {
    const value = match[1]?.trim();
    if (value) values.push(value);
  }
  return [...new Set(values)];
}

export function extractPaths(text: string): string[] {
  const candidates = [
    ...extractBacktickValues(text),
    ...(text.match(/(?:^|\s)([A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.@*{}-]+)+)/g) ?? []).map((item) => item.trim()),
  ];
  return [...new Set(candidates.filter((value) => /[/.]/.test(value) && !value.startsWith('http')))].sort();
}

export function extractSymbols(text: string): string[] {
  const backticks = extractBacktickValues(text).filter((value) => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value));
  const camel = text.match(/\b[A-Za-z_$][A-Za-z0-9_$]*(?:[A-Z][A-Za-z0-9_$]*)+\b/g) ?? [];
  return [...new Set([...backticks, ...camel])].sort();
}

export function extractTickets(text: string): string[] {
  const values = text.match(/\b[A-Z][A-Z0-9]+-\d+\b|#\d+|ticket[-_ ]?\d+/gi) ?? [];
  return [...new Set(values.map((value) => normalizeToken(value).replace(/ /g, '-').toUpperCase()))].sort();
}

export function extractVersions(text: string): string[] {
  return [...new Set(text.match(/\bv?\d+\.\d+(?:\.\d+)?(?:-[0-9A-Za-z.-]+)?\b/g) ?? [])].sort();
}

export function inferObject(text: string, action: IntentAction): string {
  const normalized = text
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\s*\[[ xX]\]\s+/, '')
    .replace(/^\s*(feat|fix|refactor|test|docs|chore|build|ci|perf)(?:\([^)]*\))?!?:\s*/i, '')
    .trim();

  const actionWords: Record<IntentAction, RegExp> = {
    add: /\b(add|create|implement|introduce|build|utworzy(?:ć|c)|doda(?:ć|c)|zaimplementowa(?:ć|c)|stworzy(?:ć|c)|zbudowa(?:ć|c))\b/i,
    fix: /\b(fix|repair|correct|napraw(?:ić|ic)|popraw(?:ić|ic))\b/i,
    remove: /\b(remove|delete|drop|usun(?:ąć|ac)|wycofa(?:ć|c))\b/i,
    refactor: /\b(refactor|restructure|przebudowa(?:ć|c)|refaktoryz)\w*/i,
    test: /\b(test|przetestowa(?:ć|c)|testowa(?:ć|c))\b/i,
    document: /\b(document|udokumentowa(?:ć|c))\b/i,
    configure: /\b(configur\w*|setup|ustawi(?:ć|c)|konfigurowa(?:ć|c))\b/i,
    analyze: /\b(analy[sz]\w*|inspect|scan|analizowa(?:ć|c)|zbada(?:ć|c))\b/i,
    validate: /\b(validat\w*|verify|check|walidowa(?:ć|c)|sprawdzi(?:ć|c))\b/i,
    call: /\b(call|wywoł)\w*/i,
    depend_on: /\b(depends?|zależ)\w*/i,
    declare: /\b(declare|deklar)\w*/i,
    release: /\b(release|wydaj)\w*/i,
    change: /\b(change|update|modify|zmieni(?:ć|c)|aktualizowa(?:ć|c)|modyfikowa(?:ć|c))\b/i,
    preserve: /\b(preserve|keep|maintain|zachowa(?:ć|c)|utrzyma(?:ć|c))\b/i,
    block: /\b(block|deny|prevent|zablokowa(?:ć|c)|zabroni(?:ć|c))\b/i,
    approve: /\b(approve|accept|zatwierdzi(?:ć|c)|zaakceptowa(?:ć|c))\b/i,
    unknown: /$a/,
  };
  const result = normalized.replace(actionWords[action], '').replace(/^\s*(to|aby|żeby)\s+/i, '').trim();
  return result || normalized || 'unspecified';
}

export function splitIntentLines(text: string): Array<{ text: string; line: number }> {
  const output: Array<{ text: string; line: number }> = [];
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const cleaned = raw
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*[-*+]\s+/, '')
      .replace(/^\s*\d+[.)]\s+/, '')
      .replace(/^\s*\[[ xX]\]\s+/, '')
      .trim();
    if (!cleaned || cleaned.length < 3) continue;
    const pieces = cleaned.split(/(?<=[.!?;])\s+(?=[A-ZĄĆĘŁŃÓŚŹŻ0-9])/u);
    for (const piece of pieces) {
      const value = piece.trim();
      if (value.length >= 3) output.push({ text: value, line: index + 1 });
    }
  }
  return output;
}
