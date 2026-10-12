"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { requireUser } from "@/server/authz";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { profileSchema } from "./schema";

export async function updateProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return {
      ok: false,
      fieldErrors: fieldErrorsFrom(parsed.error),
      values: echoValues(formData, ["fullName", "phone"]),
    };
  }

  await db.rls((tx) =>
    tx
      .update(profiles)
      .set({ fullName: parsed.data.fullName, phone: parsed.data.phone })
      .where(eq(profiles.id, user.id)),
  );

  revalidatePath("/", "layout");
  return { ok: true, message: "saved" };
}
