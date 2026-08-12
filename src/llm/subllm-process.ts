import { execFile } from 'node:child_process';
import { constants as fsConstants, promises as fs } from 'node:fs';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const RAW_PROVIDER_CREDENTIAL_RE = /\b(?:sk-or-v1-[A-Za-z0-9_-]+|[A-Za-z0-9_-]{16,}\.[A-Za-z0-9._~+/=-]{8,})\b/gu;

export async function credentialFromSharedFile(
  python: string,
  name: string,
  environment: NodeJS.ProcessEnv,
  cwd: string,
): Promise<string> {
  const envPath = await runSubllm(python, ['-m', 'subllm.cli', 'env', 'path'], environment, cwd);
  let handle: fs.FileHandle | undefined;
  try {
    handle = await fs.open(envPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
    const stat = await handle.stat();
    if (!stat.isFile()) throw new Error('SubLLM credential path is not a regular file');
    if (process.platform !== 'win32' && (stat.mode & 0o077) !== 0) {
      throw new Error('SubLLM credential file must have mode 0600');
    }
    return parseCredential(await handle.readFile('utf8'), name);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : String(caught);
    throw new Error(`Cannot read the selected SubLLM credential: ${redactDiagnostic(message)}`);
  } finally {
    await handle?.close();
  }
}

function parseCredential(content: string, selectedName: string): string {
  let value = '';
  for (const rawLine of content.split(/\r?\n/u)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.slice('export '.length).trimStart();
    const separator = line.indexOf('=');
    if (separator < 1 || line.slice(0, separator).trim() !== selectedName) continue;
    if (value) throw new Error(`duplicate ${selectedName} assignment`);
    value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
  }
  if (!value) throw new Error(`${selectedName} is missing from the shared credential file`);
  return value;
}

function redactDiagnostic(value: string): string {
  return value
    .replace(/\b(?:ZAI|OPENROUTER)_API_KEY\s*=\s*\S+/giu, '[redacted-credential]')
    .replace(/\bBearer\s+\S+/giu, 'Bearer [redacted-credential]')
    .replace(RAW_PROVIDER_CREDENTIAL_RE, '[redacted-credential]')
    .slice(0, 1000);
}

export async function runSubllm(
  python: string,
  args: string[],
  environment: NodeJS.ProcessEnv,
  cwd: string,
): Promise<string> {
  try {
    const result = await execFileAsync(python, args, {
      cwd,
      env: environment,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
      timeout: 15_000,
    });
    return result.stdout.trim();
  } catch (caught) {
    const error = caught as Error & { stdout?: string; stderr?: string };
    const diagnostic = `${error.stdout ?? ''}\n${error.stderr ?? ''}`.trim();
    throw new Error(`SubLLM route resolution failed${diagnostic ? `: ${redactDiagnostic(diagnostic)}` : ''}`);
  }
}
