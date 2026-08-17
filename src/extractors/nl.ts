import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { readText, relativePosix } from '../core/io.js';
import { buildRecord } from '../core/record.js';
import {
  detectModality,
  detectPolarity,
  extractPaths,
  extractSymbols,
  extractTickets,
  extractVersions,
  inferObject,
  splitIntentLines,
} from '../core/text.js';
import type { ExtractionResult, IntentAction, IntentRecord } from '../core/types.js';
import { classifyAction } from '../tf/classifier.js';

export interface NlExtractionOptions {
  root: string;
  sourcePath: string;
  text?: string;
}

/** Validates the public boundary before Node path helpers can throw opaque errors. */
export function assertNlExtractionOptions(options: NlExtractionOptions): void {
  if (!options || typeof options !== 'object') throw new Error('NL extraction options must be an object');
  if (typeof options.root !== 'string' || !options.root.trim()) {
    throw new Error('NL extraction option root must be a non-empty string');
  }
  if (typeof options.sourcePath !== 'string' || !options.sourcePath.trim()) {
    throw new Error('NL extraction option sourcePath must be a non-empty string');
  }
  if (options.text !== undefined && typeof options.text !== 'string') {
    throw new Error('NL extraction option text must be a string when provided');
  }
}

export async function extractNlIntent(options: NlExtractionOptions, config: T2CConfig): Promise<ExtractionResult> {
  assertNlExtractionOptions(options);
  const absolute = path.resolve(options.root, options.sourcePath);
  const body = options.text ?? await readText(absolute, config.maxFileBytes);
  const sourcePath = path.isAbsolute(options.sourcePath)
    ? relativePosix(options.root, absolute)
    : options.sourcePath.replace(/\\/g, '/');
  const records: IntentRecord[] = [];
  const warnings: string[] = [];
  const segments: IntentSegment[] = isGovernedTicketReadme(sourcePath)
    ? segmentGovernedTicketReadme(body)
    : splitIntentLines(body).map((segment) => ({ ...segment, kind: 'generic' as const }));

  for (const segment of segments) {
    const classified = await classifyAction(segment.text, config);
    const action = refineTicketSegmentAction(segment, classified.action);
    const object = inferObject(segment.text, action);
    const missing = detectMissingFields(segment.text, action, object, segment.kind);
    const confidence = Math.max(0.35, classified.confidence - missing.length * 0.06);
    records.push(buildRecord({
      kind: 'declared_intent',
      actor: inferActor(segment.text),
      action,
      object,
      target: {
        paths: extractPaths(segment.text),
        symbols: extractSymbols(segment.text),
        tickets: extractTickets(segment.text),
        versions: extractVersions(segment.text),
      },
      modality: detectModality(segment.text),
      polarity: detectPolarity(segment.text),
      text: segment.text,
      lifecycle: 'proposed',
      sourceKind: 'nl',
      sourcePath,
      sourceLines: { start: segment.line, end: segment.endLine ?? segment.line },
      extractor: segment.kind === 'generic'
        ? 't2c/nl-heuristic@1'
        : 't2c/nl-ticket-readme@1',
      epistemicClass: 'declaration',
      confidence,
      basis: [
        classified.basis,
        segment.kind === 'generic' ? 'line_segmentation' : 'ticket_section_segmentation',
        'modality_dictionary',
        'target_heuristics',
      ],
      metadata: {
        missingFields: missing,
        llmUsed: false,
        ...(segment.kind !== 'generic' ? { ticketSegment: segment.kind } : {}),
      },
    }));
  }

  if (records.length === 0) warnings.push(`No intent-like statements found in ${sourcePath}`);
  return { records, warnings };
}

type TicketSegmentKind = 'goal' | 'acceptance' | 'generic';

interface IntentSegment {
  text: string;
  line: number;
  endLine?: number;
  kind: TicketSegmentKind;
}

const TICKET_README_PATH = /(^|\/)project\/ticket-\d+\/README\.md$/i;
const METADATA_LABEL = /^\*\*(?:ID|Owner|Status|Workflow state|Created)\*\*\s*:/i;
const GOAL_SECTION = /^(?:Goal(?:\s+and\s+scope)?|Cel(?:\s+i\s+zakres)?)\b/i;
const ACCEPTANCE_SECTION = /^(?:Acceptance criteria|Kryteria akceptacji)\b/i;

/** True when the source is a governed new-project ticket README. */
export function isGovernedTicketReadme(sourcePath: string): boolean {
  return TICKET_README_PATH.test(sourcePath.replace(/\\/g, '/'));
}

/**
 * Segment a governed ticket README by semantic sections.
 *
 * Lifecycle metadata (`Status`, `Owner`, …) is dropped. Wrapped goal and
 * acceptance-criterion lines stay as single records with the originating
 * source line range.
 */
export function segmentGovernedTicketReadme(text: string): IntentSegment[] {
  const lines = text.split(/\r?\n/);
  const output: IntentSegment[] = [];
  let section: 'meta' | 'goal' | 'acceptance' | 'skip' = 'meta';
  let goalBuffer: string[] = [];
  let goalStart = 0;
  let goalEnd = 0;
  let acceptanceBuffer: string[] = [];
  let acceptanceStart = 0;
  let acceptanceEnd = 0;

  const flushGoal = (): void => {
    const value = goalBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (value.length >= 3) {
      output.push({ text: value, line: goalStart, endLine: goalEnd, kind: 'goal' });
    }
    goalBuffer = [];
  };

  const flushAcceptance = (): void => {
    const value = acceptanceBuffer.join(' ').replace(/\s+/g, ' ').trim();
    if (value.length >= 3) {
      output.push({
        text: value,
        line: acceptanceStart,
        endLine: acceptanceEnd,
        kind: 'acceptance',
      });
    }
    acceptanceBuffer = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const raw = lines[index] ?? '';
    const heading = raw.match(/^\s{0,3}#{1,6}\s+(.*)$/);
    if (heading) {
      flushGoal();
      flushAcceptance();
      section = sectionForHeadingTitle((heading[1] ?? '').trim());
      continue;
    }

    if (section === 'meta' || section === 'skip') {
      continue;
    }

    const cleaned = stripListMarker(raw);
    if (section === 'goal') {
      ({ goalBuffer, goalStart, goalEnd } = absorbProseLine({
        cleaned,
        buffer: goalBuffer,
        start: goalStart,
        end: goalEnd,
        lineNumber: index + 1,
        onBlank: flushGoal,
        skip: () => METADATA_LABEL.test(cleaned),
      }));
      continue;
    }

    ({
      acceptanceBuffer,
      acceptanceStart,
      acceptanceEnd,
    } = absorbAcceptanceLine({
      raw,
      cleaned,
      buffer: acceptanceBuffer,
      start: acceptanceStart,
      end: acceptanceEnd,
      lineNumber: index + 1,
      onBlankOrBoundary: flushAcceptance,
    }));
  }

  flushGoal();
  flushAcceptance();
  return output;
}

function sectionForHeadingTitle(title: string): 'goal' | 'acceptance' | 'skip' {
  if (GOAL_SECTION.test(title)) return 'goal';
  if (ACCEPTANCE_SECTION.test(title)) return 'acceptance';
  return 'skip';
}

function stripListMarker(raw: string): string {
  return raw
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .replace(/^\s*\[[ xX]\]\s+/, '')
    .trim();
}

function absorbProseLine(input: {
  cleaned: string;
  buffer: string[];
  start: number;
  end: number;
  lineNumber: number;
  onBlank: () => void;
  skip: () => boolean;
}): { goalBuffer: string[]; goalStart: number; goalEnd: number } {
  if (!input.cleaned) {
    input.onBlank();
    return { goalBuffer: [], goalStart: input.start, goalEnd: input.end };
  }
  if (input.skip()) {
    return { goalBuffer: input.buffer, goalStart: input.start, goalEnd: input.end };
  }
  if (input.buffer.length === 0) {
    return {
      goalBuffer: [input.cleaned],
      goalStart: input.lineNumber,
      goalEnd: input.lineNumber,
    };
  }
  return {
    goalBuffer: [...input.buffer, input.cleaned],
    goalStart: input.start,
    goalEnd: input.lineNumber,
  };
}

function absorbAcceptanceLine(input: {
  raw: string;
  cleaned: string;
  buffer: string[];
  start: number;
  end: number;
  lineNumber: number;
  onBlankOrBoundary: () => void;
}): { acceptanceBuffer: string[]; acceptanceStart: number; acceptanceEnd: number } {
  const isCheckbox = /^\s*[-*+]\s+\[[ xX]?\]\s+/.test(input.raw) || /^\s*[-*+]\s+AC-\d+/i.test(input.raw);
  const isContinuation = !isCheckbox && /^\s{2,}\S/.test(input.raw);

  if (isCheckbox) {
    input.onBlankOrBoundary();
    if (!input.cleaned) {
      return { acceptanceBuffer: [], acceptanceStart: input.start, acceptanceEnd: input.end };
    }
    return {
      acceptanceBuffer: [input.cleaned],
      acceptanceStart: input.lineNumber,
      acceptanceEnd: input.lineNumber,
    };
  }

  if (isContinuation && input.buffer.length) {
    if (!input.cleaned) {
      return { acceptanceBuffer: input.buffer, acceptanceStart: input.start, acceptanceEnd: input.end };
    }
    return {
      acceptanceBuffer: [...input.buffer, input.cleaned],
      acceptanceStart: input.start,
      acceptanceEnd: input.lineNumber,
    };
  }

  if (!input.cleaned) {
    input.onBlankOrBoundary();
    return { acceptanceBuffer: [], acceptanceStart: input.start, acceptanceEnd: input.end };
  }

  // Non-checkbox prose under Acceptance criteria still counts as a criterion.
  input.onBlankOrBoundary();
  return {
    acceptanceBuffer: [input.cleaned],
    acceptanceStart: input.lineNumber,
    acceptanceEnd: input.lineNumber,
  };
}

function refineTicketSegmentAction(
  segment: IntentSegment,
  classified: IntentAction,
): IntentAction {
  if (segment.kind === 'acceptance') return 'validate';
  if (segment.kind === 'goal' && classified === 'unknown') return 'change';
  return classified;
}

function inferActor(text: string): string | null {
  if (/\b(agent|stażysta|intern)\b/i.test(text)) return 'agent';
  if (/\b(system|aplikacja|runtime)\b/i.test(text)) return 'system';
  if (/\b(team|zesp[oó]ł)\b/i.test(text)) return 'team';
  if (/\b(user|użytkownik)\b/i.test(text)) return 'user';
  return null;
}

function detectMissingFields(
  text: string,
  action: string,
  object: string,
  kind: TicketSegmentKind = 'generic',
): string[] {
  const missing: string[] = [];
  if (action === 'unknown') missing.push('action');
  if (!object || object === 'unspecified' || object.length < 3) missing.push('object');
  if (/\b(validate|walid|sprawd)/i.test(text)) {
    if (!/\b(before|after|when|on|przed|po|gdy|kiedy|podczas)\b/i.test(text)) missing.push('trigger');
    if (!/\b(error|fail|reject|return|błąd|odrzuc|zwr[oó]ć)\b/i.test(text)) missing.push('failure_behavior');
  }
  if (kind === 'acceptance' || /\bAC-\d+\b/i.test(text)) {
    return [...new Set(missing.filter((item) => item !== 'acceptance_evidence' && item !== 'action'))].sort();
  }
  if (!/\b(test|acceptance|kryteri|dow[oó]d|evidence|result|wynik)\b/i.test(text) && text.length < 45) {
    missing.push('acceptance_evidence');
  }
  return [...new Set(missing)].sort();
}
