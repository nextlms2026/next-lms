import { sql } from "drizzle-orm";
import {
  bigserial,
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { memberRole, organizations, profiles } from "./identity";

// Writes to these tables happen ONLY through SECURITY DEFINER functions in
// drizzle/0003_team_rls.sql, which enforce ROLES-PERMISSIONS and write the
// audit log in the same transaction.

/** Staff invitation. The token is shown once as a link; only its SHA-256 is stored. */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: memberRole("role").notNull(),
    tokenHash: text("token_hash").notNull(),
    invitedBy: uuid("invited_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedBy: uuid("accepted_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("invitations_token_hash_key").on(t.tokenHash),
    index("invitations_org_id_idx").on(t.orgId),
    index("invitations_email_idx").on(t.email),
    check("invitations_role_not_owner", sql`${t.role} <> 'owner'`),
    check("invitations_email_lower", sql`${t.email} = lower(${t.email})`),
    check("invitations_token_hash_hex", sql`${t.tokenHash} ~ '^[0-9a-f]{64}$'`),
  ],
).enableRLS();

/** Append-only record of sensitive administrative actions (docs/SECURITY.md). */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    // IDs and changed field names only — never personal data.
    metadata: jsonb("metadata").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("audit_log_org_created_idx").on(t.orgId, t.createdAt)],
).enableRLS();
