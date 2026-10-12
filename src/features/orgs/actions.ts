"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { organizations } from "@/server/db/schema";
import { pgError } from "@/server/db/errors";
import { requireOrgMember, requireUser } from "@/server/authz";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { ORG_SETTINGS_FIELDS, orgSettingsSchema } from "./schema";
import { slugify, withSuffix } from "./slug";

export async function createOrganization(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireUser();
  const parsed = orgSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData, ORG_SETTINGS_FIELDS),
    };
  }
  const input = parsed.data;

  let slug = slugify(input.name);
  let created = false;
  for (let attempt = 0; attempt < 4 && !created; attempt++) {
    try {
      // SECURITY DEFINER function: inserts org + caller's owner membership
      // atomically (drizzle/0001_identity_rls.sql). Runs under the caller's JWT.
      await db.rls((tx) =>
        tx.execute(sql`select app.create_organization(
          ${input.name}, ${slug}, ${input.kind}::public.org_kind, ${input.country},
          ${input.timezone}, ${input.currency}, ${input.defaultLocale},
          ${input.weekStart}::smallint
        )`),
      );
      created = true;
    } catch (e) {
      const { code, hint } = pgError(e);
      if (code === "23505") {
        slug = withSuffix(slugify(input.name)); // slug taken: retry
        continue;
      }
      const error =
        hint === "org_limit"
          ? "orgLimit"
          : hint === "timezone"
            ? "invalidTimezone"
            : "generic";
      if (error === "generic")
        console.error("createOrganization failed", { code });
      return {
        ok: false,
        error,
        values: echoValues(formData, ORG_SETTINGS_FIELDS),
      };
    }
  }
  if (!created) {
    return {
      ok: false,
      error: "generic",
      values: echoValues(formData, ORG_SETTINGS_FIELDS),
    };
  }

  redirect(`/o/${slug}`);
}

export async function updateOrganization(
  orgSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ctx = await requireOrgMember(orgSlug, ["owner"]);
  const parsed = orgSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData, ORG_SETTINGS_FIELDS),
    };
  }

  // RLS (organizations_update_owner) is the backstop if the role check above is wrong.
  const updated = await db.rls((tx) =>
    tx
      .update(organizations)
      .set(parsed.data)
      .where(eq(organizations.id, ctx.org.id))
      .returning({ id: organizations.id }),
  );
  if (updated.length === 0) return { ok: false, error: "notAllowed" };

  revalidatePath(`/o/${orgSlug}`, "layout");
  return { ok: true, message: "saved" };
}
