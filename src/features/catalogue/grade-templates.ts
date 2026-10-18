/**
 * Starting points for an org's grade levels (ADR-010: education systems are
 * seed data, not code paths). Names are stored as editable data once seeded.
 */
export type GradeTemplateId = "generic" | "lk" | "gb" | "us" | "in";

const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `${prefix} ${from + i}`);

export const GRADE_TEMPLATES: Record<GradeTemplateId, readonly string[]> = {
  generic: range("Grade", 1, 12),
  // Sri Lanka: Grades 1–11 (O/L exam in Grade 11), A/L in Grades 12–13.
  lk: [
    ...range("Grade", 1, 11),
    "A/L Year 1 (Grade 12)",
    "A/L Year 2 (Grade 13)",
  ],
  // England & Wales: Reception, Years 1–13 (GCSE in Year 11, A-level Years 12–13).
  gb: ["Reception", ...range("Year", 1, 13)],
  us: ["Kindergarten", ...range("Grade", 1, 12)],
  in: range("Class", 1, 12),
};

/** Template to preselect for an org's country (ISO 3166-1 alpha-2). */
export function suggestGradeTemplate(country: string): GradeTemplateId {
  switch (country) {
    case "LK":
      return "lk";
    case "GB":
      return "gb";
    case "US":
      return "us";
    case "IN":
      return "in";
    default:
      return "generic";
  }
}

export const GRADE_TEMPLATE_IDS = Object.keys(
  GRADE_TEMPLATES,
) as GradeTemplateId[];
