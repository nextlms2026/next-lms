"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { clientEnv } from "@/env/client";
import { db } from "@/server/db";
import { pgError } from "@/server/db/errors";
import { requireOrgMember, requireUser } from "@/server/authz";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/form-state";
import {
  inviteSchema,
  memberRoleSchema,
  memberStatusSchema,
  uuidSchema,
} from "./schema";
import {
  generateInviteToken,
  hashInviteToken,
  inviteUrl,
  isPlausibleInviteToken,
} from "./tokens";

// Permission rules live in the SQL functions (drizzle/0003_team_rls.sql);
// these actions validate input, resolve the org server-side and map errors.

function errorKey(e: unknown): string {
  const { code, hint } = pgError(e);
  if (code === "42501") return "notAllowed";
  switch (hint) {
    case "already_member":
      return "alreadyMember";
    case "rate_limited":
      return "rateLimited";
    case "email":
      return "invalidEmail";
    case "last_owner":
      return "lastOwner";
    case "invalid_invitation":
      return "invalidInvitation";
    case "email_mismatch":
      return "invitationEmailMismatch";
  }
  console.error("team action failed", { code });
  return "generic";
}

export async function createInvitation(
  orgSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requireOrgMember(orgSlug, ["owner", "admin"]);
  const parsed = inviteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData, ["email", "role"]),
    };
  }

  const token = generateInviteToken();
  try {
    await db.rls((tx) =>
      tx.execute(sql`select app.create_invitation(
        ${ctx.org.id}, ${parsed.data.email}, ${parsed.data.role}::public.member_role,
        ${hashInviteToken(token)}
      )`),
    );
  } catch (e) {
    return {
      ok: false,
      error: errorKey(e),
      values: echoValues(formData, ["email", "role"]),
    };
  }

  revalidatePath(`/o/${orgSlug}/team`);
  // The plain token exists only in this response; the database keeps its hash.
  return {
    ok: true,
    data: {
      link: inviteUrl(clientEnv.NEXT_PUBLIC_SITE_URL, token),
      email: parsed.data.email,
      role: parsed.data.role,
    },
  };
}

async function runMemberAction(
  orgSlug: string,
  query: ReturnType<typeof sql>,
): Promise<FormState> {
  await requireOrgMember(orgSlug);
  try {
    await db.rls((tx) => tx.execute(query));
  } catch (e) {
    return { ok: false, error: errorKey(e) };
  }
  revalidatePath(`/o/${orgSlug}`, "layout");
  return { ok: true, message: "saved" };
}

export async function revokeInvitation(orgSlug: string, invitationId: string) {
  const id = uuidSchema.parse(invitationId);
  return runMemberAction(orgSlug, sql`select app.revoke_invitation(${id})`);
}

export async function changeMemberRole(
  orgSlug: string,
  membershipId: string,
  role: string,
) {
  const id = uuidSchema.parse(membershipId);
  const r = memberRoleSchema.parse(role);
  return runMemberAction(
    orgSlug,
    sql`select app.change_member_role(${id}, ${r}::public.member_role)`,
  );
}

export async function setMemberStatus(
  orgSlug: string,
  membershipId: string,
  status: string,
) {
  const id = uuidSchema.parse(membershipId);
  const s = memberStatusSchema.parse(status);
  return runMemberAction(
    orgSlug,
    sql`select app.set_member_status(${id}, ${s}::public.member_status)`,
  );
}

/** Leave a workspace (deactivate own membership), then go home. */
export async function leaveOrganization(orgSlug: string, membershipId: string) {
  const ctx = await requireOrgMember(orgSlug);
  if (ctx.membershipId !== membershipId)
    return { ok: false, error: "notAllowed" } as const;
  const result = await setMemberStatus(orgSlug, membershipId, "inactive");
  if (result && !result.ok) return result;
  redirect("/dashboard");
}

/** Accept via link token (from /invite/[token]). */
export async function acceptInvitationByToken(
  token: string,
  _prev: FormState,
): Promise<FormState> {
  await requireUser();
  if (!isPlausibleInviteToken(token))
    return { ok: false, error: "invalidInvitation" };
  let slug: string | undefined;
  try {
    const [row] = await db.rls((tx) =>
      tx.execute<{ slug: string }>(
        sql`select app.accept_invitation(${hashInviteToken(token)}) as slug`,
      ),
    );
    slug = row?.slug;
  } catch (e) {
    return { ok: false, error: errorKey(e) };
  }
  redirect(slug ? `/o/${slug}` : "/dashboard");
}

/** Accept from the "invitations for you" list (matched by verified email). */
export async function acceptInvitationById(
  invitationId: string,
  _prev: FormState,
): Promise<FormState> {
  await requireUser();
  const id = uuidSchema.safeParse(invitationId);
  if (!id.success) return { ok: false, error: "invalidInvitation" };
  let slug: string | undefined;
  try {
    const [row] = await db.rls((tx) =>
      tx.execute<{ slug: string }>(
        sql`select app.accept_invitation(null, ${id.data}) as slug`,
      ),
    );
    slug = row?.slug;
  } catch (e) {
    return { ok: false, error: errorKey(e) };
  }
  redirect(slug ? `/o/${slug}` : "/dashboard");
}
