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
import type { ExtractionResult, IntentRecord } from '../core/types.js';
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

  for (const segment of splitIntentLines(body)) {
    const classified = await classifyAction(segment.text, config);
    const action = classified.action;
    const object = inferObject(segment.text, action);
    const missing = detectMissingFields(segment.text, action, object);
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
      sourceLines: { start: segment.line, end: segment.line },
      extractor: 't2c/nl-heuristic@1',
      epistemicClass: 'declaration',
      confidence,
      basis: [classified.basis, 'line_segmentation', 'modality_dictionary', 'target_heuristics'],
      metadata: {
        missingFields: missing,
        llmUsed: false,
      },
    }));
  }

  if (records.length === 0) warnings.push(`No intent-like statements found in ${sourcePath}`);
  return { records, warnings };
}

function inferActor(text: string): string | null {
  if (/\b(agent|stażysta|intern)\b/i.test(text)) return 'agent';
  if (/\b(system|aplikacja|runtime)\b/i.test(text)) return 'system';
  if (/\b(team|zesp[oó]ł)\b/i.test(text)) return 'team';
  if (/\b(user|użytkownik)\b/i.test(text)) return 'user';
  return null;
}

function detectMissingFields(text: string, action: string, object: string): string[] {
  const missing: string[] = [];
  if (action === 'unknown') missing.push('action');
  if (!object || object === 'unspecified' || object.length < 3) missing.push('object');
  if (/\b(validate|walid|sprawd)/i.test(text)) {
    if (!/\b(before|after|when|on|przed|po|gdy|kiedy|podczas)\b/i.test(text)) missing.push('trigger');
    if (!/\b(error|fail|reject|return|błąd|odrzuc|zwr[oó]ć)\b/i.test(text)) missing.push('failure_behavior');
  }
  if (!/\b(test|acceptance|kryteri|dow[oó]d|evidence|result|wynik)\b/i.test(text) && text.length < 45) {
    missing.push('acceptance_evidence');
  }
  return [...new Set(missing)].sort();
}
