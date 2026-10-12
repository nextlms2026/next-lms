import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

// RLS policies, helper functions and triggers for these tables live in the
// hand-written migration drizzle/0001_identity_rls.sql (docs/SECURITY.md).

export const orgKind = pgEnum("org_kind", ["individual", "institute"]);
export const memberRole = pgEnum("member_role", ["owner", "admin", "teacher"]);
export const memberStatus = pgEnum("member_status", ["active", "inactive"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};

/** One row per auth user, created by trigger on signup. Global (not tenant-scoped). */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull().default(""),
    phone: text("phone"),
    locale: text("locale"),
    avatarPath: text("avatar_path"),
    ...timestamps,
  },
  (t) => [
    check("profiles_full_name_len", sql`char_length(${t.fullName}) <= 120`),
    check(
      "profiles_phone_e164",
      sql`${t.phone} is null or ${t.phone} ~ '^\\+[1-9][0-9]{6,14}$'`,
    ),
  ],
).enableRLS();

/** The tenant. See ADR-001 and ADR-010. */
export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    kind: orgKind("kind").notNull(),
    country: text("country").notNull(),
    timezone: text("timezone").notNull(),
    currency: text("currency").notNull(),
    defaultLocale: text("default_locale").notNull(),
    weekStart: smallint("week_start").notNull(),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    ...timestamps,
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "organizations_name_len",
      sql`char_length(btrim(${t.name})) between 1 and 120`,
    ),
    check(
      "organizations_slug_format",
      sql`${t.slug} ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'`,
    ),
    check("organizations_country_iso", sql`${t.country} ~ '^[A-Z]{2}$'`),
    check("organizations_currency_iso", sql`${t.currency} ~ '^[A-Z]{3}$'`),
    check(
      "organizations_week_start_range",
      sql`${t.weekStart} between 0 and 6`,
    ),
  ],
).enableRLS();

/** Staff membership of an org. This is the "teacher profile" within an org (docs/DATABASE.md). */
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    role: memberRole("role").notNull(),
    status: memberStatus("status").notNull().default("active"),
    ...timestamps,
  },
  (t) => [
    unique("memberships_org_user_key").on(t.orgId, t.userId),
    // Target for composite (org_id, membership_id) FKs from tenant tables.
    unique("memberships_org_id_id_key").on(t.orgId, t.id),
    index("memberships_user_id_idx").on(t.userId),
  ],
).enableRLS();
