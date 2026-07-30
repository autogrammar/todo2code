import { stableStringify } from '../core/id.js';
import type { BinaryMetric } from './gold-types.js';

export interface Counts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
}

export function emptyCounts(): Counts {
  return { truePositive: 0, falsePositive: 0, falseNegative: 0 };
}

export function addCounts(target: Counts, value: Counts): void {
  target.truePositive += value.truePositive;
  target.falsePositive += value.falsePositive;
  target.falseNegative += value.falseNegative;
}

export function compareSets(actual: unknown[], expected: unknown[]): Counts {
  const actualCounts = frequency(actual.map(stableStringify));
  const expectedCounts = frequency(expected.map(stableStringify));
  const counts = emptyCounts();
  for (const key of new Set([...actualCounts.keys(), ...expectedCounts.keys()])) {
    const actualCount = actualCounts.get(key) ?? 0;
    const expectedCount = expectedCounts.get(key) ?? 0;
    counts.truePositive += Math.min(actualCount, expectedCount);
    counts.falsePositive += Math.max(0, actualCount - expectedCount);
    counts.falseNegative += Math.max(0, expectedCount - actualCount);
  }
  return counts;
}

function frequency(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) ?? 0) + 1));
  return counts;
}

export function metric(counts: Counts): BinaryMetric {
  return {
    ...counts,
    precision: ratio(counts.truePositive, counts.truePositive + counts.falsePositive),
    recall: ratio(counts.truePositive, counts.truePositive + counts.falseNegative),
  };
}

export function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 1 : Math.round((numerator / denominator) * 1_000_000) / 1_000_000;
}
