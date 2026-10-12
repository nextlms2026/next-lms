import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { createSupabaseServerClient } from "./supabase";
import type { VerifiedClaims } from "./db/rls-settings";

/**
 * Returns the caller's JWT claims after cryptographic verification, or null if signed out.
 * Never use `getSession()` for identity on the server — its contents are not verified.
 * Cached per request.
 */
export const getVerifiedClaims = cache(
  async (): Promise<VerifiedClaims | null> => {
    // Identity is always request-time: never part of a prerender or prefetch
    // (token expiry checks use the current time).
    await connection();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) return null;
    const { sub, role } = data.claims;
    if (typeof sub !== "string" || typeof role !== "string") return null;
    return { ...data.claims, sub, role };
  },
);
