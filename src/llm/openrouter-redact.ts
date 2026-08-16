const BEARER_CREDENTIAL_RE = new RegExp('\\bBearer\\s+[A-Za-z0-9._~-]{8,}', 'giu');
const OPENROUTER_CREDENTIAL_RE = /\bsk-or-v1-[A-Za-z0-9_-]+/gu;
const SECRET_ASSIGNMENT_RE = new RegExp(
  '\\b((?:api|access)[-_\\s]?key|client[-_\\s]?secret|token|password)\\s*[:=#]\\s*[A-Za-z0-9_./+=~-]{12,}\\b',
  'giu',
);
const PROVIDER_MANAGEMENT_URL_RE = /https?:\/\/[^\s<>"']*(?:\/(?:keys?|credentials?)(?:\/|[?#]|$))[^\s<>"']*/giu;
const CREDENTIAL_IDENTIFIER_RE = new RegExp(
  '\\b((?:api[-_\\s]?key|credential|key)[-_\\s]?(?:id|fingerprint))\\s*[:=#]?\\s*[A-Za-z0-9_-]{20,}\\b',
  'giu',
);

/**
 * Provider error bodies are untrusted external text. Keep their useful status
 * explanation, but never let a credential, stable credential identifier or
 * account-management URL cross the common LLM boundary.
 */
export function redactProviderFailureText(message: string, configuredCredential: string | null): string {
  let redacted = message;
  if (configuredCredential) redacted = redacted.split(configuredCredential).join('[redacted-credential]');
  return redacted
    .replace(BEARER_CREDENTIAL_RE, 'Bearer [redacted-credential]')
    .replace(OPENROUTER_CREDENTIAL_RE, '[redacted-credential]')
    .replace(SECRET_ASSIGNMENT_RE, '$1=[redacted-credential]')
    .replace(PROVIDER_MANAGEMENT_URL_RE, '[redacted-provider-management-url]')
    .replace(CREDENTIAL_IDENTIFIER_RE, '$1 [redacted-credential-id]');
}
