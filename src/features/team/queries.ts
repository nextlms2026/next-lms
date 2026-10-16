import "server-only";
import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { db, withRlsClaims } from "@/server/db";
import { auditLog, invitations, profiles } from "@/server/db/schema";
import { getVerifiedClaims } from "@/server/auth";
import type { MemberRole } from "@/server/authz";
import { hashInviteToken, isPlausibleInviteToken } from "./tokens";

export type TeamMember = {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null; // null unless the caller is owner/admin
  role: MemberRole;
  status: "active" | "inactive";
  joinedAt: string;
};

/** Via app.list_team: emails/inactive members only for owners and admins. */
export async function listTeam(orgId: string): Promise<TeamMember[]> {
  const rows = await db.rls((tx) =>
    tx.execute<{
      membership_id: string;
      user_id: string;
      full_name: string;
      email: string | null;
      role: MemberRole;
      status: "active" | "inactive";
      joined_at: string;
    }>(sql`select * from app.list_team(${orgId})`),
  );
  return rows.map((r) => ({
    membershipId: r.membership_id,
    userId: r.user_id,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    status: r.status,
    joinedAt: r.joined_at,
  }));
}

/** Pending invitations (RLS: owners/admins of the org only). */
export async function listPendingInvitations(orgId: string) {
  return db.rls((tx) =>
    tx
      .select({
        id: invitations.id,
        email: invitations.email,
        role: invitations.role,
        expiresAt: invitations.expiresAt,
      })
      .from(invitations)
      .where(
        and(
          eq(invitations.orgId, orgId),
          isNull(invitations.acceptedAt),
          isNull(invitations.revokedAt),
          gt(invitations.expiresAt, sql`now()`),
        ),
      )
      .orderBy(desc(invitations.createdAt)),
  );
}

/** Invitations addressed to the signed-in user's verified email. */
export async function listMyPendingInvitations() {
  const rows = await db.rls((tx) =>
    tx.execute<{
      id: string;
      org_name: string;
      role: MemberRole;
      expires_at: string;
    }>(sql`select * from app.my_pending_invitations()`),
  );
  return rows.map((r) => ({ id: r.id, orgName: r.org_name, role: r.role }));
}

export type InvitationPreview = {
  orgName: string;
  role: MemberRole;
  emailMasked: string;
  status: "pending" | "expired" | "used" | "revoked";
};

/** Works signed in or out (anon may preview a link it holds). */
export async function getInvitationPreview(
  token: string,
): Promise<InvitationPreview | null> {
  if (!isPlausibleInviteToken(token)) return null;
  const hash = hashInviteToken(token);
  const rows = await withRlsClaims(await getVerifiedClaims(), (tx) =>
    tx.execute<{
      org_name: string;
      role: MemberRole;
      email_masked: string;
      status: InvitationPreview["status"];
    }>(sql`select * from app.invitation_preview(${hash})`),
  );
  const r = rows[0];
  return r
    ? {
        orgName: r.org_name,
        role: r.role,
        emailMasked: r.email_masked,
        status: r.status,
      }
    : null;
}

/** Most recent audit entries (RLS: owners/admins of the org only). */
export async function listAuditLog(orgId: string, limit = 200) {
  return db.rls((tx) =>
    tx
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        metadata: auditLog.metadata,
        createdAt: auditLog.createdAt,
        actorName: profiles.fullName,
      })
      .from(auditLog)
      .leftJoin(profiles, eq(profiles.id, auditLog.actorId))
      .where(eq(auditLog.orgId, orgId))
      .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
      .limit(limit),
  );
}
