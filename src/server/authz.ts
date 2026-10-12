import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { memberships, organizations } from "@/server/db/schema";
import { getVerifiedClaims } from "@/server/auth";

export type MemberRole = (typeof memberships.$inferSelect)["role"];

export type CurrentUser = { id: string; email: string };

/** Signed-in user or redirect to /login. Use at the top of protected pages/actions. */
export const requireUser = cache(async (): Promise<CurrentUser> => {
  const claims = await getVerifiedClaims();
  if (!claims) redirect("/login");
  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : "",
  };
});

/**
 * The org (by URL slug) plus the caller's ACTIVE membership in it, read under RLS.
 * Returns null when the org doesn't exist, is archived, or the caller isn't a member —
 * callers must not distinguish these cases (no existence leaks).
 */
export const getOrgContext = cache(async (slug: string) => {
  const user = await requireUser();
  const rows = await db.rls((tx) =>
    tx
      .select({
        org: organizations,
        membershipId: memberships.id,
        role: memberships.role,
      })
      .from(organizations)
      .innerJoin(
        memberships,
        and(
          eq(memberships.orgId, organizations.id),
          eq(memberships.userId, user.id),
          eq(memberships.status, "active"),
        ),
      )
      .where(
        and(eq(organizations.slug, slug), isNull(organizations.archivedAt)),
      )
      .limit(1),
  );
  const row = rows[0];
  return row ? { user, ...row } : null;
});

export type OrgContext = NonNullable<Awaited<ReturnType<typeof getOrgContext>>>;

/** Org membership (optionally restricted to roles) or 404. */
export async function requireOrgMember(
  slug: string,
  roles?: readonly MemberRole[],
): Promise<OrgContext> {
  const ctx = await getOrgContext(slug);
  if (!ctx || (roles && !roles.includes(ctx.role))) notFound();
  return ctx;
}
