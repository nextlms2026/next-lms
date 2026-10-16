import type { MemberRole } from "@/server/authz";

/**
 * Which member actions to OFFER in the UI. Mirrors the SQL functions in
 * drizzle/0003_team_rls.sql, which are the actual enforcement.
 */
export type MemberActions = {
  changeRole: boolean;
  deactivate: boolean;
  reactivate: boolean;
  leave: boolean;
};

export function memberActions(
  caller: { role: MemberRole; membershipId: string },
  target: {
    membershipId: string;
    role: MemberRole;
    status: "active" | "inactive";
  },
): MemberActions {
  const self = caller.membershipId === target.membershipId;
  const canManage =
    caller.role === "owner" ||
    (caller.role === "admin" && target.role === "teacher");
  return {
    changeRole: caller.role === "owner" && !self,
    deactivate: !self && canManage && target.status === "active",
    reactivate: !self && canManage && target.status === "inactive",
    leave: self && target.status === "active",
  };
}

/** Roles the caller may invite. */
export function invitableRoles(
  callerRole: MemberRole,
): ("admin" | "teacher")[] {
  if (callerRole === "owner") return ["teacher", "admin"];
  if (callerRole === "admin") return ["teacher"];
  return [];
}
