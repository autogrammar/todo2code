import path from 'node:path';
import type { T2CConfig } from '../config/env.js';
import type { IntakeEnvelope } from '../communication/intake-contract.js';
import { decodeIntakeEnvelope, encodeIntakeResult } from '../communication/intake-protobuf.js';
import { GovernedIntakeService } from '../communication/intake-service.js';
import { assertPathWithinRoot } from '../core/security.js';

export type IntakeAction = 'intake_command' | 'intake_query';

export async function executeIntakeAction(
  action: IntakeAction,
  input: Record<string, unknown>,
  config: T2CConfig,
  context: { authenticatedPrincipal?: string; allowBootstrap?: boolean } = {},
): Promise<unknown> {
  const requestedRoot = typeof input.root === 'string' && input.root.trim() ? input.root : config.root;
  const root = await assertPathWithinRoot(config.root, path.resolve(config.root, requestedRoot), config.allowOutsideRoot);
  const projectDir = typeof input.projectDir === 'string' && input.projectDir.trim() ? input.projectDir : 'project';
  const operation = action === 'intake_command' ? 'command' : 'query';
  const supplied = envelopeInput(input, operation);
  const envelope = context.authenticatedPrincipal === undefined
    ? supplied
    : { ...supplied, authenticatedPrincipal: context.authenticatedPrincipal };
  const service = new GovernedIntakeService(root, projectDir);
  const result = operation === 'command'
    ? await service.command(envelope, { allowBootstrap: context.allowBootstrap ?? true })
    : await service.query(envelope);
  if (input.outputFormat === 'protobuf') {
    return { mediaType: 'application/x-protobuf', data: Buffer.from(encodeIntakeResult(result)).toString('base64'), result };
  }
  return result;
}

function envelopeInput(input: Record<string, unknown>, operation: 'command' | 'query'): IntakeEnvelope {
  if (typeof input.protobuf === 'string' && input.protobuf) return decodeIntakeEnvelope(Buffer.from(input.protobuf, 'base64'), operation);
  if (!input.envelope || typeof input.envelope !== 'object' || Array.isArray(input.envelope)) return input.envelope as IntakeEnvelope;
  return input.envelope as IntakeEnvelope;
}
