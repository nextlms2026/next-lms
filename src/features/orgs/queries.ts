import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/server/db";
import { memberships, organizations } from "@/server/db/schema";
import { requireUser } from "@/server/authz";

/** Active, non-archived orgs the current user is a staff member of. */
export async function listMyOrganizations() {
  const user = await requireUser();
  return db.rls((tx) =>
    tx
      .select({
        slug: organizations.slug,
        name: organizations.name,
        kind: organizations.kind,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.orgId))
      .where(
        and(
          eq(memberships.userId, user.id),
          eq(memberships.status, "active"),
          isNull(organizations.archivedAt),
        ),
      )
      .orderBy(asc(organizations.name)),
  );
}
