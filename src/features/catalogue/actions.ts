"use server";

import { revalidatePath } from "next/cache";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { gradeLevels, locations, subjects } from "@/server/db/schema";
import { pgError } from "@/server/db/errors";
import { requireOrgMember } from "@/server/authz";
import { echoValues, fieldErrorsFrom, type FormState } from "@/lib/form-state";
import { uuidSchema } from "@/features/team/schema";
import { GRADE_TEMPLATES, type GradeTemplateId } from "./grade-templates";
import {
  catalogueKindSchema,
  gradeLevelSchema,
  gradeTemplateSchema,
  locationSchema,
  subjectSchema,
  type CatalogueKind,
} from "./schema";

// requireOrgMember(owner/admin) gives a clear UI error; RLS
// (drizzle/0005_catalogue_rls.sql) is the backstop if that check is ever wrong.

const MANAGERS = ["owner", "admin"] as const;
const FIELDS = {
  subjects: ["name", "code"],
  grades: ["name"],
  locations: ["name", "kind", "address"],
} as const;

function writeError(e: unknown): string {
  const { code } = pgError(e);
  if (code === "23505") return "duplicateName";
  if (code === "42501") return "notAllowed";
  console.error("catalogue write failed", { code });
  return "generic";
}

function done(orgSlug: string): FormState {
  revalidatePath(`/o/${orgSlug}/settings`, "layout");
  return { ok: true, message: "saved" };
}

export async function createCatalogueItem(
  orgSlug: string,
  kindInput: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const kind = catalogueKindSchema.parse(kindInput);
  const { org } = await requireOrgMember(orgSlug, MANAGERS);
  const input = Object.fromEntries(formData);
  const values = echoValues(formData, FIELDS[kind]);

  try {
    if (kind === "subjects") {
      const p = subjectSchema.safeParse(input);
      if (!p.success)
        return { ok: false, fieldErrors: fieldErrorsFrom(p.error), values };
      await db.rls((tx) =>
        tx.insert(subjects).values({ orgId: org.id, ...p.data }),
      );
    } else if (kind === "grades") {
      const p = gradeLevelSchema.safeParse(input);
      if (!p.success)
        return { ok: false, fieldErrors: fieldErrorsFrom(p.error), values };
      await db.rls(async (tx) => {
        // Append after the current last grade.
        const [last] = await tx
          .select({
            max: sql<number>`coalesce(max(${gradeLevels.sortOrder}), 0)`,
          })
          .from(gradeLevels)
          .where(eq(gradeLevels.orgId, org.id));
        await tx.insert(gradeLevels).values({
          orgId: org.id,
          name: p.data.name,
          sortOrder: (last?.max ?? 0) + 10,
        });
      });
    } else {
      const p = locationSchema.safeParse(input);
      if (!p.success)
        return { ok: false, fieldErrors: fieldErrorsFrom(p.error), values };
      await db.rls((tx) =>
        tx.insert(locations).values({ orgId: org.id, ...p.data }),
      );
    }
  } catch (e) {
    return { ok: false, error: writeError(e), values };
  }
  return done(orgSlug);
}

export async function updateCatalogueItem(
  orgSlug: string,
  kindInput: string,
  idInput: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const kind = catalogueKindSchema.parse(kindInput);
  const id = uuidSchema.parse(idInput);
  const { org } = await requireOrgMember(orgSlug, MANAGERS);
  const input = Object.fromEntries(formData);
  const values = echoValues(formData, FIELDS[kind]);

  let updated: { id: string }[];
  try {
    if (kind === "subjects") {
      const p = subjectSchema.safeParse(input);
      if (!p.success)
        return { ok: false, fieldErrors: fieldErrorsFrom(p.error), values };
      updated = await db.rls((tx) =>
        tx
          .update(subjects)
          .set(p.data)
          .where(and(eq(subjects.id, id), eq(subjects.orgId, org.id)))
          .returning({ id: subjects.id }),
      );
    } else if (kind === "grades") {
      const p = gradeLevelSchema.safeParse(input);
      if (!p.success)
        return { ok: false, fieldErrors: fieldErrorsFrom(p.error), values };
      updated = await db.rls((tx) =>
        tx
          .update(gradeLevels)
          .set(p.data)
          .where(and(eq(gradeLevels.id, id), eq(gradeLevels.orgId, org.id)))
          .returning({ id: gradeLevels.id }),
      );
    } else {
      const p = locationSchema.safeParse(input);
      if (!p.success)
        return { ok: false, fieldErrors: fieldErrorsFrom(p.error), values };
      updated = await db.rls((tx) =>
        tx
          .update(locations)
          .set(p.data)
          .where(and(eq(locations.id, id), eq(locations.orgId, org.id)))
          .returning({ id: locations.id }),
      );
    }
  } catch (e) {
    return { ok: false, error: writeError(e), values };
  }
  if (updated.length === 0) return { ok: false, error: "notAllowed" };
  return done(orgSlug);
}

/** Archive or restore. Restoring fails with duplicateName if an active item took the name. */
export async function setCatalogueArchived(
  orgSlug: string,
  kindInput: string,
  idInput: string,
  archived: boolean,
): Promise<FormState> {
  const kind: CatalogueKind = catalogueKindSchema.parse(kindInput);
  const id = uuidSchema.parse(idInput);
  const { org } = await requireOrgMember(orgSlug, MANAGERS);
  const archivedAt = archived ? new Date() : null;
  const table =
    kind === "subjects"
      ? subjects
      : kind === "grades"
        ? gradeLevels
        : locations;

  try {
    const updated = await db.rls((tx) =>
      tx
        .update(table)
        .set({ archivedAt })
        .where(and(eq(table.id, id), eq(table.orgId, org.id)))
        .returning({ id: table.id }),
    );
    if (updated.length === 0) return { ok: false, error: "notAllowed" };
  } catch (e) {
    return { ok: false, error: writeError(e) };
  }
  return done(orgSlug);
}

/** Moves an active grade level one place up or down (swaps sort_order with its neighbour). */
export async function moveGradeLevel(
  orgSlug: string,
  idInput: string,
  direction: "up" | "down",
): Promise<FormState> {
  const id = uuidSchema.parse(idInput);
  const { org } = await requireOrgMember(orgSlug, MANAGERS);

  try {
    await db.rls(async (tx) => {
      const active = await tx
        .select({ id: gradeLevels.id, sortOrder: gradeLevels.sortOrder })
        .from(gradeLevels)
        .where(
          and(eq(gradeLevels.orgId, org.id), isNull(gradeLevels.archivedAt)),
        )
        .orderBy(asc(gradeLevels.sortOrder), asc(gradeLevels.name));
      const i = active.findIndex((g) => g.id === id);
      const j = direction === "up" ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= active.length) return;
      // Renumber everything so equal sort orders can't make a swap a no-op.
      const reordered = active.map((g) => g.id);
      [reordered[i], reordered[j]] = [reordered[j]!, reordered[i]!];
      for (const [index, gradeId] of reordered.entries()) {
        await tx
          .update(gradeLevels)
          .set({ sortOrder: (index + 1) * 10 })
          .where(
            and(eq(gradeLevels.id, gradeId), eq(gradeLevels.orgId, org.id)),
          );
      }
    });
  } catch (e) {
    return { ok: false, error: writeError(e) };
  }
  return done(orgSlug);
}

/** Seeds grade levels from a template; only when the org has no active grades yet. */
export async function seedGradeLevels(
  orgSlug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { org } = await requireOrgMember(orgSlug, MANAGERS);
  const p = gradeTemplateSchema.safeParse(Object.fromEntries(formData));
  if (!p.success) return { ok: false, fieldErrors: fieldErrorsFrom(p.error) };
  const names = GRADE_TEMPLATES[p.data.template as GradeTemplateId];

  try {
    await db.rls(async (tx) => {
      const existing = await tx
        .select({ id: gradeLevels.id })
        .from(gradeLevels)
        .where(
          and(eq(gradeLevels.orgId, org.id), isNull(gradeLevels.archivedAt)),
        )
        .limit(1);
      if (existing.length > 0)
        throw Object.assign(new Error("not empty"), { code: "23505" });
      await tx.insert(gradeLevels).values(
        names.map((name, i) => ({
          orgId: org.id,
          name,
          sortOrder: (i + 1) * 10,
        })),
      );
    });
  } catch (e) {
    return { ok: false, error: writeError(e) };
  }
  return done(orgSlug);
}
