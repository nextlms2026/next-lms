/**
 * Postgres error details from a thrown error. Drizzle wraps driver errors in
 * DrizzleQueryError with the PostgresError as `cause`.
 */
export function pgError(e: unknown): { code?: string; hint?: string } {
  let cur: unknown = e;
  for (let i = 0; i < 3 && cur && typeof cur === "object"; i++) {
    const { code, hint } = cur as { code?: unknown; hint?: unknown };
    if (typeof code === "string" && /^[0-9A-Z]{5}$/.test(code)) {
      return { code, hint: typeof hint === "string" ? hint : undefined };
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return {};
}
