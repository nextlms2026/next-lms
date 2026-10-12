import "server-only";
import { createSupabaseServerClient } from "./supabase";
import type { VerifiedClaims } from "./db/rls-settings";

/**
 * Returns the caller's JWT claims after cryptographic verification, or null if signed out.
 * Never use `getSession()` for identity on the server — its contents are not verified.
 */
export async function getVerifiedClaims(): Promise<VerifiedClaims | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  const { sub, role } = data.claims;
  if (typeof sub !== "string" || typeof role !== "string") return null;
  return { ...data.claims, sub, role };
}
