/**
 * Translates verified Supabase JWT claims into the Postgres settings that RLS reads.
 * Pure function (no server-only import) so it can be unit tested.
 *
 * Supabase's `auth.uid()` / `auth.jwt()` read `request.jwt.claims`; the `role` setting
 * switches the transaction from the privileged connection role to `authenticated`/`anon`.
 */
export type VerifiedClaims = {
  sub: string;
  role: string;
  [key: string]: unknown;
};

export type RlsSettings = {
  role: "authenticated" | "anon";
  claimsJson: string;
};

export function toRlsSettings(claims: VerifiedClaims | null): RlsSettings {
  if (claims === null) {
    return { role: "anon", claimsJson: JSON.stringify({ role: "anon" }) };
  }
  if (claims.role !== "authenticated") {
    // Never let a token escalate to service_role/postgres or any unexpected role.
    throw new Error(`Unsupported JWT role for RLS context: ${claims.role}`);
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) {
    throw new Error("JWT claims are missing a subject");
  }
  return { role: "authenticated", claimsJson: JSON.stringify(claims) };
}
