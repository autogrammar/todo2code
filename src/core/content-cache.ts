import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { sha256, stableStringify } from './id.js';
import { ensureDir } from './io.js';
import type { ContentCacheStats } from './types.js';

const CACHE_SCHEMA_VERSION = 't2c.content-cache/v1';

interface CacheEnvelope {
  schemaVersion: typeof CACHE_SCHEMA_VERSION;
  namespace: string;
  key: string;
  value: unknown;
}

export interface ContentCacheOptions {
  root: string;
  outputDir: string;
  enabled?: boolean;
}

export interface ContentCacheEntryOptions<T> {
  namespace: string;
  inputs: unknown;
  compute: () => Promise<T> | T;
  validate: (value: unknown) => value is T;
  shouldStore?: (value: T) => boolean;
}

/**
 * Persistent, content-addressed cache for deterministic extractor work.
 * Cache I/O is deliberately fail-open: source extraction remains authoritative.
 */
export class ContentCache {
  readonly stats: ContentCacheStats = {
    hits: 0,
    misses: 0,
    writes: 0,
    recoveries: 0,
    errors: 0,
    bypassed: 0,
  };

  private readonly directory: string;
  private readonly enabled: boolean;

  constructor(options: ContentCacheOptions) {
    this.directory = path.resolve(options.root, options.outputDir, 'cache', 'v1');
    this.enabled = options.enabled ?? true;
  }

  async getOrCompute<T>(options: ContentCacheEntryOptions<T>): Promise<T> {
    assertNamespace(options.namespace);
    if (!this.enabled) {
      this.stats.bypassed += 1;
      return options.compute();
    }

    const key = sha256(stableStringify({ namespace: options.namespace, inputs: options.inputs }));
    const filePath = path.join(this.directory, options.namespace, `${key}.json`);
    const cached = await this.read<T>(filePath, options.namespace, key, options.validate);
    if (cached.found) {
      this.stats.hits += 1;
      return cached.value;
    }

    this.stats.misses += 1;
    const value = await options.compute();
    if (options.shouldStore && !options.shouldStore(value)) return value;
    await this.write(filePath, { schemaVersion: CACHE_SCHEMA_VERSION, namespace: options.namespace, key, value });
    return value;
  }

  snapshot(): ContentCacheStats {
    return { ...this.stats };
  }

  private async read<T>(
    filePath: string,
    namespace: string,
    key: string,
    validate: (value: unknown) => value is T,
  ): Promise<{ found: true; value: T } | { found: false }> {
    let body: string;
    try {
      body = await fs.readFile(filePath, 'utf8');
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return { found: false };
      this.stats.errors += 1;
      return { found: false };
    }

    try {
      const envelope = JSON.parse(body) as Partial<CacheEnvelope>;
      if (
        envelope.schemaVersion !== CACHE_SCHEMA_VERSION
        || envelope.namespace !== namespace
        || envelope.key !== key
        || !validate(envelope.value)
      ) {
        this.stats.recoveries += 1;
        return { found: false };
      }
      return { found: true, value: envelope.value };
    } catch {
      this.stats.recoveries += 1;
      return { found: false };
    }
  }

  private async write(filePath: string, envelope: CacheEnvelope): Promise<void> {
    const directory = path.dirname(filePath);
    const temporaryPath = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
    try {
      await ensureDir(directory);
      await fs.writeFile(temporaryPath, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', flag: 'wx' });
      await fs.rename(temporaryPath, filePath);
      this.stats.writes += 1;
    } catch {
      this.stats.errors += 1;
      try {
        await fs.unlink(temporaryPath);
      } catch {
        // The temporary file may not have been created; cache failures stay non-fatal.
      }
    }
  }
}

function assertNamespace(namespace: string): void {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(namespace)) {
    throw new Error(`Invalid cache namespace: ${namespace}`);
  }
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code;
}
