import type { DiffLine, LineChangeType } from './text-types.js';

export interface RawDiffOp {
  type: LineChangeType;
  beforeIndex: number | null;
  afterIndex: number | null;
  text: string;
}

interface MyersState {
  n: number;
  m: number;
  offset: number;
}

interface MyersEditPoint {
  x: number;
  y: number;
}

export function blockReplace(before: string[], after: string[]): RawDiffOp[] {
  return [
    ...before.map((text, index) => ({ type: 'delete' as const, beforeIndex: index, afterIndex: null, text })),
    ...after.map((text, index) => ({ type: 'insert' as const, beforeIndex: null, afterIndex: index, text })),
  ];
}

/** Myers' greedy O(ND) diff with a stored trace for backtracking. */
export function myers(before: string[], after: string[]): RawDiffOp[] {
  const state = createMyersState(before, after);
  if (state.n === 0 && state.m === 0) return [];
  if (state.n === 0 || state.m === 0) return blockReplace(before, after);

  const trace: Int32Array[] = [];
  let v = new Int32Array(2 * (state.n + state.m) + 1);

  for (let d = 0; d <= state.n + state.m; d += 1) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const startX = chooseStartX(v, state, k, d);
      const point = advanceDiagonal(before, after, startX, startX - k, state);
      v[state.offset + k] = point.x;
      if (point.x >= state.n && point.y >= state.m) {
        return backtrack(trace, before, after, d, state.offset);
      }
    }
  }
  /* c8 ignore next -- unreachable: d === n + m always terminates above */
  return blockReplace(before, after);
}

function createMyersState(before: string[], after: string[]): MyersState {
  const n = before.length;
  const m = after.length;
  return { n, m, offset: n + m };
}

function chooseStartX(v: Int32Array, state: MyersState, k: number, d: number): number {
  if (k === -d || (k !== d && (v[state.offset + k - 1] ?? 0) < (v[state.offset + k + 1] ?? 0))) {
    return v[state.offset + k + 1] ?? 0;
  }
  return (v[state.offset + k - 1] ?? 0) + 1;
}

function advanceDiagonal(
  before: string[],
  after: string[],
  x: number,
  y: number,
  state: MyersState,
): MyersEditPoint {
  let nextX = x;
  let nextY = y;
  while (nextX < state.n && nextY < state.m && before[nextX] === after[nextY]) {
    nextX += 1;
    nextY += 1;
  }
  return { x: nextX, y: nextY };
}

function backtrack(
  trace: Int32Array[],
  before: string[],
  after: string[],
  d: number,
  offset: number,
): RawDiffOp[] {
  const ops: RawDiffOp[] = [];
  let x = before.length;
  let y = after.length;
  for (let step = d; step > 0; step -= 1) {
    const v = trace[step];
    if (!v) break;
    const k = x - y;
    const previous = choosePreviousPoint(v, offset, k, step);
    const previousX = previous.x;
    const previousY = previous.y;
    const diag = emitEqualOps(ops, before, x, y, previousX, previousY);
    const afterEqualX = diag.x;
    const afterEqualY = diag.y;
    emitEditOp(ops, before, after, afterEqualX, afterEqualY, previousX);
    x = previousX;
    y = previousY;
  }
  while (x > 0 && y > 0) {
    x -= 1;
    y -= 1;
    ops.push({ type: 'equal', beforeIndex: x, afterIndex: y, text: before[x] ?? '' });
  }
  return ops.reverse();
}

function choosePreviousPoint(v: Int32Array, offset: number, k: number, step: number): MyersEditPoint {
  const previousK = k === -step || (k !== step && (v[offset + k - 1] ?? 0) < (v[offset + k + 1] ?? 0))
    ? k + 1
    : k - 1;
  const previousX = v[offset + previousK] ?? 0;
  return { x: previousX, y: previousX - previousK };
}

function emitEqualOps(
  ops: RawDiffOp[],
  before: string[],
  x: number,
  y: number,
  previousX: number,
  previousY: number,
): MyersEditPoint {
  while (x > previousX && y > previousY) {
    x -= 1;
    y -= 1;
    ops.push({ type: 'equal', beforeIndex: x, afterIndex: y, text: before[x] ?? '' });
  }
  return { x, y };
}

function emitEditOp(
  ops: RawDiffOp[],
  before: string[],
  after: string[],
  x: number,
  y: number,
  previousX: number,
): void {
  if (x === previousX) {
    y -= 1;
    ops.push({ type: 'insert', beforeIndex: null, afterIndex: y, text: after[y] ?? '' });
    return;
  }
  x -= 1;
  ops.push({ type: 'delete', beforeIndex: x, afterIndex: null, text: before[x] ?? '' });
}
