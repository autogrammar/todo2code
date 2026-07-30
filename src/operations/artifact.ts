import { promises as fs } from 'node:fs';
import path from 'node:path';
import { sha256, stableStringify } from '../core/id.js';
import { compileSubactorProcessEnvelope } from './subactor.js';
import type { OperationPlan, ResolvedVariableBinding, SubactorProcessEnvelope } from './types.js';

export interface CompileOperationPlanArtifactOptions {
  planPath: string;
  bindingsPath: string;
  outputPath: string;
  correlationId: string;
}

export interface OperationPlanCompilationReceipt {
  schema: 't2c.operation-plan-compilation-receipt/v1';
  planId: string;
  planHash: string;
  envelopeHash: string;
  outputPath: string;
}

async function readJson(pathname: string, label: string): Promise<unknown> {
  try {
    return JSON.parse(await fs.readFile(pathname, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(`${label} could not be read as JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function writeExclusive(pathname: string, value: string): Promise<void> {
  const target = path.resolve(pathname);
  const directory = path.dirname(target);
  const temporary = path.join(directory, `.${path.basename(target)}.${process.pid}.tmp`);
  try {
    const existing = await fs.lstat(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing) throw new Error(`Operation envelope output already exists: ${target}`);
    await fs.writeFile(temporary, value, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fs.rename(temporary, target);
  } catch (error) {
    await fs.unlink(temporary).catch(() => undefined);
    throw error;
  }
}

/** Compile one artifact without dispatching it or creating a Subactor ticket. */
export async function compileOperationPlanArtifact(
  options: CompileOperationPlanArtifactOptions,
): Promise<{ envelope: SubactorProcessEnvelope; receipt: OperationPlanCompilationReceipt }> {
  const plan = await readJson(options.planPath, 'Operation plan') as OperationPlan;
  const bindings = await readJson(options.bindingsPath, 'Variable bindings') as Record<string, ResolvedVariableBinding>;
  const envelope = compileSubactorProcessEnvelope(plan, { correlationId: options.correlationId, bindings });
  await writeExclusive(options.outputPath, `${JSON.stringify(envelope, null, 2)}\n`);
  return {
    envelope,
    receipt: {
      schema: 't2c.operation-plan-compilation-receipt/v1',
      planId: plan.id,
      planHash: plan.planHash,
      envelopeHash: sha256(stableStringify(envelope)),
      outputPath: path.resolve(options.outputPath),
    },
  };
}
