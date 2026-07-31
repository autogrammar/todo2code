import type { IntentAction, Modality, Polarity } from './types.js';

const ACTION_PATTERNS: Array<[IntentAction, RegExp]> = [
  ['remove', /\b(remove|delete|drop|usun(?:ąć|ac)|wycofa(?:ć|c)|likwidowa(?:ć|c))\b/i],
  ['fix', /\b(fix|repair|correct|napraw(?:ić|ic)|popraw(?:ić|ic)|bug)\b/i],
  ['refactor', /\b(refactor|restructure|reorganiz|przebudowa(?:ć|c)|refaktoryz)/i],
  ['test', /\b(test|spec|coverage|przetestowa(?:ć|c)|testowa(?:ć|c))\b/i],
  ['document', /\b(document|docs|readme|changelog|udokumentowa(?:ć|c)|dokumentacj)/i],
  ['configure', /\b(configur|setup|ustawi(?:ć|c)|konfigur)/i],
  ['validate', /\b(validat(?:e[sd]?|ing)|verify|check|walid(?:uj\w*|ow\w*)|sprawdzi(?:ć|c)|zweryfikowa(?:ć|c))\b/i],
  ['analyze', /\b(analy[sz]|inspect|scan|compare|analiz|por[oó]wn|zbada(?:ć|c))\b/i],
  ['block', /\b(block|deny|prevent|zablokowa(?:ć|c)|zabroni(?:ć|c))\b/i],
  ['approve', /\b(approve|accept|zatwierdzi(?:ć|c)|zaakceptowa(?:ć|c))\b/i],
  ['add', /\b(add|create|implement|introduce|build|utworzy(?:ć|c)|doda(?:ć|c)|zaimplementowa(?:ć|c)|stworzy(?:ć|c)|zbudowa(?:ć|c))\b/i],
  ['change', /\b(change|update|modify|zmieni(?:ć|c)|aktualizowa(?:ć|c)|modyfikowa(?:ć|c))\b/i],
  ['preserve', /\b(preserve|keep|maintain|zachowa(?:ć|c)|utrzyma(?:ć|c))\b/i],
];

/**
 * Function words, folded exactly as `keywords` folds its input.
 *
 * The list used to be written with diacritics, which meant `się`, `może` and
 * `należy` could never match: `keywords` compares against `normalizeToken`
 * output, where they are already `sie`, `moze` and `nalezy`. Measured on
 * `subactor/platform` the unfiltered forms were among the most frequent
 * "topics" in the whole corpus — `nie` 175, `jest` 110, `jako` 54 — and topic
 * buckets keep only the first twelve tokens per record, so pure grammar was
 * displacing real vocabulary before matching even began.
 */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'to', 'of', 'for', 'in', 'on', 'with', 'from', 'by',
  'i', 'oraz', 'lub', 'do', 'z', 'ze', 'na', 'w', 'we', 'dla', 'przez', 'sie', 'ma',
  'musi', 'musza', 'powinien', 'powinna', 'powinno', 'powinny', 'nalezy', 'trzeba',
  'moze', 'moga', 'system', 'agent',
  'nie', 'jest', 'sa', 'jako', 'bez', 'ani', 'albo', 'ale', 'tylko', 'wylacznie',
  'tego', 'tym', 'tej', 'ten', 'ta', 'to', 'te', 'przy', 'po', 'przed', 'aby', 'gdy',
  'kazdy', 'kazda', 'kazde', 'juz', 'tez', 'takze', 'byc', 'byl', 'byla', 'bylo',
].map((value) => normalizeToken(value)));

export function classifyActionHeuristically(text: string): IntentAction {
  const conventional = text.match(/^\s*(feat|fix|refactor|test|docs|chore|build|ci|perf)(?:\([^)]*\))?!?:/i)?.[1]?.toLowerCase();
  if (conventional === 'feat') return 'add';
  if (conventional === 'fix') return 'fix';
  if (conventional === 'refactor' || conventional === 'perf') return 'refactor';
  if (conventional === 'test') return 'test';
  if (conventional === 'docs') return 'document';
  if (conventional === 'build' || conventional === 'ci' || conventional === 'chore') return 'configure';
  // Inline code is a target, not a verb. Without masking it, an identifier
  // such as `validateContract` can override the explicit verb "implement".
  const prose = text.replace(/`[^`]*`/g, ' ');
  // Fold diacritics before dictionary matching. JavaScript's `\b` treats letters such
  // as `ć` or `ą` as non-word characters, so matching only the raw Polish text
  // would miss perfectly valid imperatives such as `dodać`.
  const searchable = normalizeToken(prose);
  for (const [action, pattern] of ACTION_PATTERNS) {
    if (pattern.test(prose) || pattern.test(searchable)) return action;
  }
  return 'unknown';
}

/**
 * Explicit bans. Deliberately narrow: "cannot" and "may not" also appear in
 * descriptive prose ("the parser cannot read binary files"), where reading a
 * prohibition would resurrect the false-plan noise the modality rules exist to
 * suppress.
 */
const PROHIBITION = /\bnie\s+wolno\b|\bnie\s+moz[ea]\b|\bnie\s+moga\b|\bzabronion[ey]\b|\bzakazan[ey]\b|\b(?:is|are)\s+not\s+allowed\b|\b(?:is|are)\s+forbidden\b/i;

/** Periphrastic obligation: as binding as `must`, and common in documentation. */
const OBLIGATION = /\b(?:has|have|had)\s+to\b|\bma(?:ja)?\s+obowiazek\b|\bjest\s+zobowiazan[ya]\b/i;

const REQUIRED_MODALS = /\b(must|shall|musi|musza|nalezy|trzeba|wymaga)\b/i;

const RECOMMENDED_MODALS = /\b(should|ought|powinien|powinna|powinno|powinny|zaleca)\b/i;

const OPTIONAL_MODALS = /\b(may|optional|can|moze|moga|opcjonaln)\b/i;

/**
 * Classify deontic force of a requirement sentence.
 *
 * Parenthetical and bracket labels such as "OpenRouter (recommended)" or
 * "[required]" are section titles, not obligations. Bare adjectives in noun
 * phrases ("List recommended models", "Required secrets") are also not
 * deontic. Only modal verbs and predicative obligation forms count — measured
 * false `PLANNED_NOT_IMPLEMENTED` noise on `code2logic` came almost entirely
 * from headings that merely contained the word "recommended".
 *
 * Prohibitions are obligations, not permissions. "Nie wolno publikować wyniku"
 * and "the client is not allowed to retry" state a requirement whose polarity
 * is negative; `detectPolarity` carries the negation. Matching them before the
 * permissive rule matters because "nie może" contains "może": read in the wrong
 * order, an outright ban is filed as `optional`.
 *
 * Polish modals are matched on the diacritic-folded text, as
 * `classifyActionHeuristically` already does. JavaScript's `\b` treats `ą` as a
 * non-word character, so `\bmuszą\b` could never match the word it names — the
 * plural of "must" was silently unreadable.
 */
export function detectModality(text: string): Modality {
  const prose = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/`[^`]*`/g, ' ');
  const searchable = normalizeToken(prose);
  const matches = (pattern: RegExp): boolean => pattern.test(prose) || pattern.test(searchable);
  if (matches(PROHIBITION)) return 'required';
  if (matches(REQUIRED_MODALS)) return 'required';
  if (matches(OBLIGATION)) return 'required';
  if (/\brequired\s+to\b|\bis\s+required\b|\bare\s+required\b|^\s*required\s*:/i.test(prose)) return 'required';
  if (matches(RECOMMENDED_MODALS)) return 'recommended';
  if (/\b(?:is|are|was|were|be|being)\s+recommended\b|\brecommended\s+to\b|\brecommend(?:s|ed)?\s+that\b/i.test(prose)) {
    return 'recommended';
  }
  if (matches(OPTIONAL_MODALS)) return 'optional';
  return 'unknown';
}

/**
 * Classify polarity of an intent sentence.
 *
 * "without" / "bez" often introduce a manner complement ("Document X without
 * inventing files") and must not flip the whole statement to negative. Clause-
 * level negators (`not`, `never`, bare `nie`, prohibitions) still count.
 */
export function detectPolarity(text: string): Polarity {
  const prose = text.replace(/`[^`]*`/g, ' ');
  // Drop prepositional complements: "without inventing …", "bez zgadywania …".
  const stripped = prose
    .replace(/\bwithout\b\s+(?:[\w'-]+(?:\s+[\w'-]+){0,6})/gi, ' ')
    .replace(/\bbez\b\s+(?:[\wąćęłńóśźż'-]+(?:\s+[\wąćęłńóśźż'-]+){0,6})/gi, ' ');
  if (/\b(no|not|never|nie|zakaz|zabronion)\b/i.test(stripped)) return 'negative';
  return 'positive';
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

// Inflections are folded per family. A missing one is not cosmetic: the
// capability floor counts three shared topics, so a single unfolded form such
// as "validated" was enough to drop a genuine prose-to-module pair below it.
const TOPIC_ALIASES: Record<string, string> = {
  config: 'configure', configured: 'configure', configuration: 'configure', configures: 'configure',
  docs: 'document', documentation: 'document', documented: 'document', documenting: 'document',
  diagnose: 'diagnostic', diagnostics: 'diagnostic', diagnosed: 'diagnostic',
  extraction: 'extract', extractor: 'extract', extractors: 'extract', extracted: 'extract',
  extracts: 'extract', extracting: 'extract',
  linker: 'link', linking: 'link', linked: 'link', links: 'link',
  summarizer: 'summary', summarize: 'summary', summaries: 'summary', summarized: 'summary',
  tests: 'test', tested: 'test', testing: 'test',
  validation: 'validate', validator: 'validate', validators: 'validate', validated: 'validate',
  validates: 'validate', validating: 'validate',
  verified: 'validate', verify: 'validate', verifies: 'validate', verification: 'validate',
};

/**
 * Polish domain vocabulary mapped onto the English words repositories name
 * their modules with.
 *
 * `subactor/platform` documents itself in Polish and writes identifiers in
 * English, so `module_topic` — three shared normalised topics — almost never
 * fired: `implementation coverage` 5,9% against 22,3% on an English-documented
 * repository. Nothing here is inferred; the entries are the inflected forms
 * actually observed in that corpus, plus Polish endings on English loanwords
 * (`ticketu`, `foundera`), which no English fold could reach.
 *
 * This is deliberately a dictionary and not a similarity model: a wrong entry
 * is one reviewable line, and the three-topic floor still has to be cleared.
 */
const POLISH_TOPIC_ALIASES: Record<string, string> = {
  walidacja: 'validate', walidacji: 'validate', walidacje: 'validate', waliduje: 'validate',
  walidowac: 'validate', weryfikacja: 'validate', weryfikacji: 'validate', weryfikowac: 'validate',
  dokumentacja: 'document', dokumentacji: 'document', dokument: 'document', dokumentu: 'document',
  dokumentowac: 'document', udokumentowane: 'document',
  konfiguracja: 'configure', konfiguracji: 'configure', konfiguracje: 'configure',
  skonfigurowac: 'configure', ustawienie: 'configure', ustawienia: 'configure',
  ekstrakcja: 'extract', ekstrakcji: 'extract', wyodrebnia: 'extract',
  diagnostyka: 'diagnostic', diagnostyki: 'diagnostic', diagnostyke: 'diagnostic',
  podsumowanie: 'summary', podsumowania: 'summary', podsumowuje: 'summary',
  rejestr: 'registry', rejestru: 'registry', rejestrze: 'registry',
  uczestnik: 'participant', uczestnika: 'participant', uczestnicy: 'participant',
  uczestnikow: 'participant', uczestnikach: 'participant',
  tozsamosc: 'identity', tozsamosci: 'identity',
  kontrakt: 'contract', kontraktu: 'contract', kontrakty: 'contract', kontraktow: 'contract',
  plik: 'file', pliku: 'file', pliki: 'file', plikow: 'file', plikach: 'file',
  sciezka: 'path', sciezki: 'path', sciezke: 'path', sciezek: 'path',
  katalog: 'directory', katalogu: 'directory', katalogi: 'directory',
  zadanie: 'task', zadania: 'task', zadan: 'task',
  wymaganie: 'requirement', wymagania: 'requirement', wymagan: 'requirement',
  raport: 'report', raportu: 'report', raporty: 'report', raportuje: 'report',
  raportowac: 'report', raportowanie: 'report',
  wersja: 'version', wersji: 'version', wersje: 'version',
  srodowisko: 'environment', srodowiska: 'environment', srodowisku: 'environment',
  klucz: 'key', klucza: 'key', klucze: 'key', kluczy: 'key',
  blad: 'error', bledy: 'error', bledow: 'error', bledu: 'error',
  odpowiedz: 'response', odpowiedzi: 'response',
  zapytanie: 'query', zapytania: 'query',
  wpis: 'entry', wpisu: 'entry', wpisy: 'entry', wpisow: 'entry',
  dowod: 'evidence', dowodu: 'evidence', dowody: 'evidence', dowodow: 'evidence',
  zmiana: 'change', zmiany: 'change', zmian: 'change',
  uprawnienie: 'permission', uprawnienia: 'permission', uprawnien: 'permission',
  bezpieczenstwo: 'security', bezpieczenstwa: 'security',
  dostep: 'access', dostepu: 'access',
  uzytkownik: 'user', uzytkownika: 'user', uzytkownicy: 'user',
  polityka: 'policy', polityki: 'policy',
  // Polish endings on English loanwords: the identifier is already English.
  ticketu: 'ticket', ticketem: 'ticket', tickety: 'ticket', ticketow: 'ticket',
  foundera: 'founder', founderowi: 'founder', founderem: 'founder',
  tokena: 'token', tokenu: 'token', tokeny: 'token',
  planu: 'plan', plany: 'plan', planow: 'plan',
  audytu: 'audit', audyt: 'audit',
  grafu: 'graph', graf: 'graph', grafie: 'graph',
  relacja: 'relation', relacje: 'relation', relacji: 'relation',
};

const GENERIC_TOPICS = new Set([
  'action', 'actions', 'basic', 'capabilities', 'index', 'input', 'intent', 'module',
  'output', 'record', 'records', 'result', 'runtime', 'sdk', 'src', 'type', 'types',
  'value', 'values',
]);

/**
 * Produces bounded semantic topic tokens for module-to-intent matching.
 *
 * Unlike `keywords`, this deliberately splits paths, qualified symbols and
 * camelCase identifiers, then folds common implementation/documentation word
 * forms. It is used only for module aggregates and declared sources; applying
 * it to every low-level AST call would recreate the quadratic graph noise the
 * module boundary is intended to prevent.
 */
export function topicKeywords(value: string): string[] {
  const separated = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[\/._#:-]+/g, ' ');
  return [...new Set(keywords(separated)
    .map(foldTopicToken)
    .filter((token) => token.length >= 3 && !GENERIC_TOPICS.has(token)))]
    .sort();
}

/**
 * Folds one token to its topic form: dictionary family first, then a regular
 * English plural.
 *
 * Prose says "documentation chunks", a path says `documentation-chunk-cache`.
 * Against a floor of three shared topics one unmatched plural is the whole
 * difference between a found and a missed module, and no dictionary can list
 * every noun a repository invents. The `ss`/`us`/`is`/`as`/`os` guard keeps
 * genuine singulars — `status`, `class`, `analysis`, `alias` — intact, and
 * `-ies` folds to `-y` so `capabilities` reaches `capability` instead of
 * stopping at the non-word `capabilitie`, which then escaped the generic-topic
 * filter entirely.
 */
function foldTopicToken(token: string): string {
  const aliased = TOPIC_ALIASES[token] ?? POLISH_TOPIC_ALIASES[token];
  if (aliased) return aliased;
  if (token.length < 4 || !token.endsWith('s') || /(?:ss|us|is|as|os)$/.test(token)) return token;
  const singular = token.length >= 5 && token.endsWith('ies')
    ? `${token.slice(0, -3)}y`
    : token.slice(0, -1);
  return TOPIC_ALIASES[singular] ?? POLISH_TOPIC_ALIASES[singular] ?? singular;
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
  return [...new Set(candidates.filter(isPathLike))].sort();
}

/** Placeholder segments (`<ticket>`, `<id>`) and shell/HTTP fragments. */
const NOT_A_PATH = /[\s<>=(),;"'|?]/;
/** Contract identifiers such as `t2c.conclusion/v1` are versions, not files. */
const CONTRACT_ID = /^[a-z0-9]+(?:[.-][a-z0-9-]+)+\/v\d+$/i;
/**
 * Extensions that actually occur in the repositories t2c analyses.
 *
 * A generic `\.[a-z0-9]{1,8}$` rule cannot tell `latest.json` from
 * `statement.object`: documentation refers to DSL fields in dotted form all the
 * time, and `.object`, `.basis` or `.detail` satisfy any shape-based test.
 * Those references are already captured by `extractSymbols`, so restricting
 * paths to known extensions moves them to the right field instead of losing
 * them.
 */
const FILE_EXTENSIONS = new Set([
  'ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs', 'json', 'jsonl',
  'md', 'markdown', 'txt', 'rst', 'adoc',
  'py', 'pyi', 'go', 'rs', 'java', 'kt', 'php', 'rb', 'cs', 'c', 'h', 'cpp', 'hpp',
  'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'env', 'properties',
  'sh', 'bash', 'zsh', 'ps1', 'bat', 'mk',
  'html', 'htm', 'css', 'scss', 'svg', 'png', 'jpg', 'gif', 'ico',
  'sql', 'xml', 'csv', 'lock', 'patch', 'diff', 'log', 'zip', 'whl', 'gradle',
]);

/**
 * True when the candidate ends in a recognised file extension.
 *
 * The last segment must actually contain a dot: without that check a bare
 * `NL/Markdown` reports "markdown" as its extension and prose passes as a path.
 */
function hasFileExtension(value: string): boolean {
  const last = value.split('/').pop() ?? '';
  const dot = last.lastIndexOf('.');
  if (dot <= 0 || dot === last.length - 1) return false;
  return FILE_EXTENSIONS.has(last.slice(dot + 1).toLowerCase());
}
const PATH_ROOTS = new Set([
  'app', 'apps', 'bin', 'config', 'docs', 'examples', 'infra', 'lib', 'packages',
  'project', 'public', 'scripts', 'sdk', 'src', 'test', 'tests', 'tools',
]);

/**
 * Decides whether a candidate names a file or directory rather than prose.
 *
 * Documentation is full of slash-separated alternations — `human/agent`,
 * `NL/Markdown`, `TypeScript/JavaScript`, `GET /api/runs` — and the original
 * "contains a slash or a dot" rule accepted all of them. On this repository 69
 * of 81 extracted TODO/CHANGELOG paths were such fragments, which turned them
 * into Intent-vs-Reality topics and buried the real files.
 *
 * Extensionless paths are limited to conventional repository roots (or an
 * explicit `./` prefix). That keeps planned paths such as `src/runtime` while
 * rejecting traversal and ambiguous lowercase prose such as `vars/consts`.
 */
function isPathLike(value: string): boolean {
  if (!/[/.]/.test(value) || value.startsWith('http')) return false;
  if (NOT_A_PATH.test(value)) return false;
  if (CONTRACT_ID.test(value)) return false;
  // `target.paths` means "repository path", which is relative by definition.
  // Absolute values are HTTP routes (`/api/plans/propose`, `/events`) or host
  // paths (`/var/run/docker.sock`, `/dev/kvm`); a platform repository yielded 36
  // of them and they crashed code-change planning. Parent traversal can never
  // name a file inside the analysed tree either.
  if (value.startsWith('/') || value.split('/').includes('..')) return false;

  const segments = value.split('/');
  if (hasFileExtension(value)) return true;
  // A dotted candidate without a slash and without a known extension is a DSL
  // field reference (`statement.object`, `epistemic.basis`) or a qualified
  // symbol, not a file. `extractSymbols` already records it.
  if (segments.length === 1) return false;
  if (segments[0] && !PATH_ROOTS.has(segments[0].toLowerCase())
    && !value.startsWith('./') && !value.startsWith('../')) {
    return false;
  }
  // Without an extension, an all-capitalised alternation (`Git/AST`) is prose
  // or a symbol, never a path in this repository.
  return !segments.every((word) => /^[A-Z]/.test(word));
}

/**
 * Top-level domains common in infrastructure documentation.
 *
 * A dotted value such as `logo.subactor.com` satisfies every shape test for a
 * qualified code symbol, and `symbolAliases` then reduces it to the leaf `com`
 * — an alias that matches every other hostname in the repository. On an
 * infrastructure platform this collapsed 15 unrelated documentation records
 * into one `com` topic.
 */
const HOST_TLDS = new Set([
  'com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'info', 'biz', 'name',
  'io', 'ai', 'co', 'me', 'tv', 'cc', 'xyz', 'cloud', 'tech', 'online', 'site',
  'pl', 'de', 'uk', 'eu', 'fr', 'es', 'it', 'nl', 'cz', 'sk', 'ua', 'ru', 'us',
]);

/** True when the dotted value names a host rather than a qualified symbol. */
function isHostname(value: string): boolean {
  const parts = value.split('.');
  if (parts.length < 2) return false;
  const tld = parts.at(-1)?.toLowerCase() ?? '';
  if (!HOST_TLDS.has(tld)) return false;
  // A qualified symbol carries case (`Runtime.validate`); hostnames do not.
  return parts.every((part) => part === part.toLowerCase());
}

export function extractSymbols(text: string): string[] {
  const backticks = extractBacktickValues(text).filter((value) => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(value));
  const camel = text.match(/\b[A-Za-z_$][A-Za-z0-9_$]*(?:[A-Z][A-Za-z0-9_$]*)+\b/g) ?? [];
  // Ticket prefixes such as `T2C` in `T2C-101` satisfy the loose camel-case
  // expression, but they identify work items rather than code symbols.
  const ticketPrefixes = new Set(extractTickets(text)
    .map((ticket) => ticket.match(/^([A-Z][A-Z0-9]+)-\d+$/)?.[1])
    .filter((value): value is string => Boolean(value)));
  return [...new Set([...backticks, ...camel]
    .filter((value) => !ticketPrefixes.has(value.toUpperCase()))
    .filter((value) => !isHostname(value)))].sort();
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
    if (/^\s{0,3}#{1,6}\s+/.test(raw)) continue;
    const cleaned = raw
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
