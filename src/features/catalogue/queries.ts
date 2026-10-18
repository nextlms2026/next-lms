import "server-only";
import { asc, eq, sql, type SQLWrapper } from "drizzle-orm";
import { db } from "@/server/db";
import { gradeLevels, locations, subjects } from "@/server/db/schema";

// RLS: any active member of the org may read; callers pass the org from
// requireOrgMember(), never from client input.

const activeFirst = (archivedAt: SQLWrapper) => sql`${archivedAt} is not null`;

export function listSubjects(orgId: string) {
  return db.rls((tx) =>
    tx
      .select({
        id: subjects.id,
        name: subjects.name,
        code: subjects.code,
        archivedAt: subjects.archivedAt,
      })
      .from(subjects)
      .where(eq(subjects.orgId, orgId))
      .orderBy(
        activeFirst(subjects.archivedAt),
        asc(sql`lower(${subjects.name})`),
      ),
  );
}

export function listGradeLevels(orgId: string) {
  return db.rls((tx) =>
    tx
      .select({
        id: gradeLevels.id,
        name: gradeLevels.name,
        sortOrder: gradeLevels.sortOrder,
        archivedAt: gradeLevels.archivedAt,
      })
      .from(gradeLevels)
      .where(eq(gradeLevels.orgId, orgId))
      .orderBy(
        activeFirst(gradeLevels.archivedAt),
        asc(gradeLevels.sortOrder),
        asc(gradeLevels.name),
      ),
  );
}

export function listLocations(orgId: string) {
  return db.rls((tx) =>
    tx
      .select({
        id: locations.id,
        name: locations.name,
        kind: locations.kind,
        address: locations.address,
        archivedAt: locations.archivedAt,
      })
      .from(locations)
      .where(eq(locations.orgId, orgId))
      .orderBy(
        activeFirst(locations.archivedAt),
        asc(sql`lower(${locations.name})`),
      ),
  );
}
