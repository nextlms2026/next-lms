import { z } from "zod";
import { GRADE_TEMPLATE_IDS } from "./grade-templates";

// Messages are i18n keys under `errors.*` (messages/en.json).

const name = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(max, { error: "tooLong" });

/** Empty optional text → null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: "tooLong" })
    .transform((v) => (v === "" ? null : v));

export const catalogueKindSchema = z.enum(["subjects", "grades", "locations"]);
export type CatalogueKind = z.infer<typeof catalogueKindSchema>;

export const subjectSchema = z.object({
  name: name(80),
  code: optionalText(20).optional().default(""),
});

export const gradeLevelSchema = z.object({ name: name(60) });

export const locationKinds = ["institute", "hall", "home", "online"] as const;

export const locationSchema = z.object({
  name: name(80),
  kind: z.enum(locationKinds, { error: "required" }),
  address: optionalText(300).optional().default(""),
});

export const gradeTemplateSchema = z.object({
  template: z.enum(GRADE_TEMPLATE_IDS as [string, ...string[]], {
    error: "required",
  }),
});
