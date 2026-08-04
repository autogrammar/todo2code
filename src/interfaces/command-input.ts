export function looksLikeJson(text: string): boolean {
  return text.startsWith('{');
}
