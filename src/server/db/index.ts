import "server-only";
import { sql } from "drizzle-orm";
import { getVerifiedClaims } from "@/server/auth";
import { getClient, type Transaction } from "./client";
import { toRlsSettings, type VerifiedClaims } from "./rls-settings";

export type { Transaction };

/**
 * Runs `fn` in a transaction that Postgres treats as the given user, so every
 * RLS policy applies. Claims must come from `getVerifiedClaims()`, never from input.
 */
export async function withRlsClaims<T>(
  claims: VerifiedClaims | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  const { role, claimsJson } = toRlsSettings(claims);
  return getClient().transaction(async (tx) => {
    // Both values are bound parameters; set_config(..., true) is transaction-local.
    await tx.execute(
      sql`select set_config('request.jwt.claims', ${claimsJson}, true), set_config('role', ${role}, true)`,
    );
    return fn(tx);
  });
}

export const db = {
  /** Request-scoped, RLS-enforced access as the current (verified) user. */
  async rls<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
    return withRlsClaims(await getVerifiedClaims(), fn);
  },
};
