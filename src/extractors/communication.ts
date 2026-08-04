import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import { pathExists, readText, relativePosix, walkFiles } from '../core/io.js';
import type { ExtractionResult } from '../core/types.js';
import { assertPathWithinRoot } from '../core/security.js';
import { loadParticipantIdentityRegistry } from '../communication/identity.js';
import { extractCommunicationFile } from './communication-file-helpers.js';

export type { CommunicationRole, CommunicationType } from './communication-helpers.js';

export interface CommunicationExtractionOptions {
  root: string;
  projectDir?: string;
  ticket?: string | null;
}

/**
 * Converts append-only human/agent communication under project/<ticket>/ to
 * canonical agent_log records. Front matter is intentionally parsed without a
 * YAML dependency: the contract is a flat key/value envelope, not arbitrary
 * YAML.
 */
export async function extractCommunicationIntent(
  options: CommunicationExtractionOptions,
  config: T2CConfig,
): Promise<ExtractionResult> {
  const root = path.resolve(options.root);
  const projectRoot = await assertPathWithinRoot(
    root,
    path.resolve(root, options.projectDir ?? 'project'),
    config.allowOutsideRoot,
  );
  if (!(await pathExists(projectRoot))) {
    return { records: [], warnings: [`Communication directory not found: ${relativePosix(root, projectRoot)}`] };
  }

  const files = await walkFiles(projectRoot, { extensions: ['.md', '.txt'], maxFiles: 20_000 });
  const identityRegistry = await loadParticipantIdentityRegistry(
    root, projectRoot, config.maxFileBytes, config.allowOutsideRoot,
  );
  const records: ExtractionResult['records'] = [];
  const warnings: string[] = [];
  let communicationFiles = 0;

  for (const file of files) {
    const fileResult = await extractCommunicationFile(
      file,
      projectRoot,
      root,
      options,
      config,
      readText,
      identityRegistry,
    );
    if (!fileResult) continue;
    communicationFiles += fileResult.communicationFiles;
    records.push(...fileResult.records);
    warnings.push(...fileResult.warnings);
  }

  if (records.length === 0 && communicationFiles > 0) warnings.push('No intent-like communication statements were found');
  return { records, warnings: [...new Set(warnings)].sort() };
}
