import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./identity";

// RLS policies and privileges: drizzle/0005_catalogue_rls.sql.
// Rows are archived, never deleted (classes will reference them in M5).

export const locationKind = pgEnum("location_kind", [
  "institute",
  "hall",
  "home",
  "online",
]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
};

const orgId = () =>
  uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    name: text("name").notNull(),
    code: text("code"),
    ...timestamps,
  },
  (t) => [
    unique("subjects_org_id_id_key").on(t.orgId, t.id),
    // Names are unique among ACTIVE items (an archived name can be reused).
    uniqueIndex("subjects_org_name_active_key")
      .on(t.orgId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    check(
      "subjects_name_len",
      sql`char_length(btrim(${t.name})) between 1 and 80`,
    ),
    check(
      "subjects_code_len",
      sql`${t.code} is null or char_length(${t.code}) <= 20`,
    ),
  ],
).enableRLS();

export const gradeLevels = pgTable(
  "grade_levels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    unique("grade_levels_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("grade_levels_org_name_active_key")
      .on(t.orgId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    check(
      "grade_levels_name_len",
      sql`char_length(btrim(${t.name})) between 1 and 60`,
    ),
  ],
).enableRLS();

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: orgId(),
    name: text("name").notNull(),
    kind: locationKind("kind").notNull(),
    address: text("address"),
    ...timestamps,
  },
  (t) => [
    unique("locations_org_id_id_key").on(t.orgId, t.id),
    uniqueIndex("locations_org_name_active_key")
      .on(t.orgId, sql`lower(${t.name})`)
      .where(sql`${t.archivedAt} is null`),
    check(
      "locations_name_len",
      sql`char_length(btrim(${t.name})) between 1 and 80`,
    ),
    check(
      "locations_address_len",
      sql`${t.address} is null or char_length(${t.address}) <= 300`,
    ),
  ],
).enableRLS();
