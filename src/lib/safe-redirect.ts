/**
 * Accept only same-origin relative paths for post-login / email-link redirects,
 * preventing open redirects (e.g. `//evil.com`, `/\evil.com`, `https://…`).
 */
export function safeRedirectPath(
  value: string | null | undefined,
  fallback: string,
): string {
  if (!value || !value.startsWith("/")) return fallback;
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  // Reject control characters and backslashes anywhere (browser normalisation tricks).
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}
