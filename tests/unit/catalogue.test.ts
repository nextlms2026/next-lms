import { describe, expect, it } from "vitest";
import {
  GRADE_TEMPLATES,
  GRADE_TEMPLATE_IDS,
  suggestGradeTemplate,
} from "@/features/catalogue/grade-templates";
import {
  catalogueKindSchema,
  locationSchema,
  subjectSchema,
} from "@/features/catalogue/schema";

describe("grade templates", () => {
  it.each(GRADE_TEMPLATE_IDS)("%s has unique, DB-valid names", (id) => {
    const names = GRADE_TEMPLATES[id];
    expect(names.length).toBeGreaterThan(5);
    expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    for (const n of names) expect(n.length).toBeLessThanOrEqual(60); // grade_levels_name_len
  });

  it("matches local systems", () => {
    expect(GRADE_TEMPLATES.lk.at(-1)).toBe("A/L Year 2 (Grade 13)");
    expect(GRADE_TEMPLATES.gb[0]).toBe("Reception");
    expect(GRADE_TEMPLATES.us[0]).toBe("Kindergarten");
    expect(GRADE_TEMPLATES.in.at(-1)).toBe("Class 12");
  });

  it("suggests a template from the org country, generic otherwise", () => {
    expect(suggestGradeTemplate("LK")).toBe("lk");
    expect(suggestGradeTemplate("GB")).toBe("gb");
    expect(suggestGradeTemplate("BR")).toBe("generic");
  });
});

describe("catalogue schemas", () => {
  it("trims names and turns empty optional fields into null", () => {
    expect(subjectSchema.parse({ name: "  Physics ", code: " " })).toEqual({
      name: "Physics",
      code: null,
    });
    expect(
      locationSchema.parse({ name: "Hall A", kind: "hall", address: "" }),
    ).toEqual({ name: "Hall A", kind: "hall", address: null });
  });

  it("rejects empty names, long names and unknown kinds", () => {
    expect(subjectSchema.safeParse({ name: "  " }).success).toBe(false);
    expect(subjectSchema.safeParse({ name: "x".repeat(81) }).success).toBe(
      false,
    );
    expect(
      locationSchema.safeParse({ name: "X", kind: "castle" }).success,
    ).toBe(false);
  });

  it("only accepts known catalogue kinds (bound action argument)", () => {
    expect(catalogueKindSchema.safeParse("subjects").success).toBe(true);
    expect(catalogueKindSchema.safeParse("profiles").success).toBe(false);
  });
});
