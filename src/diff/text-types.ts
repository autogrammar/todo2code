export type LineChangeType = 'equal' | 'insert' | 'delete';

export interface DiffLine {
  type: LineChangeType;
  /** 1-based line number in the "before" text, or null for inserted lines. */
  beforeLine: number | null;
  /** 1-based line number in the "after" text, or null for deleted lines. */
  afterLine: number | null;
  text: string;
}

export interface DiffHunk {
  beforeStart: number;
  beforeCount: number;
  afterStart: number;
  afterCount: number;
  lines: DiffLine[];
}

export interface FileDiff {
  schemaVersion: 't2c.filediff/v1';
  path: string;
  beforePath: string;
  afterPath: string;
  hunks: DiffHunk[];
  summary: { added: number; removed: number; unchanged: number };
  /** True when the pair exceeded `maxCompareLines` and was reduced to a block replace. */
  truncated: boolean;
}

export interface DiffTextOptions {
  path?: string;
  beforePath?: string;
  afterPath?: string;
  /** Lines of unchanged context kept around each change. */
  context?: number;
  /** Maximum middle-section size handled by Myers before bounded fallback. */
  maxCompareLines?: number;
}
