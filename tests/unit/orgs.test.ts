import { describe, expect, it } from "vitest";
import { slugify, withSuffix } from "@/features/orgs/slug";
import { regionalDefaults } from "@/features/orgs/browser-defaults";
import { orgSettingsSchema } from "@/features/orgs/schema";
import { COUNTRY_CODES, COUNTRY_CURRENCY } from "@/lib/geo/countries";

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/; // DB constraint

describe("slugify", () => {
  it.each([
    ["Kamal's Maths Classes", "kamal-s-maths-classes"],
    ["  École Saint-Joseph  ", "ecole-saint-joseph"],
    ["A/L Physics — 2027", "a-l-physics-2027"],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(slugify(input)).toMatch(SLUG_RE);
  });

  it("falls back for names with no Latin characters", () => {
    expect(slugify("ගණිත පන්තිය")).toBe("workspace");
    expect(slugify("مدرسة")).toBe("workspace");
  });

  it("keeps long names within the DB limit", () => {
    const slug = withSuffix(slugify("x".repeat(200)));
    expect(slug).toMatch(SLUG_RE);
  });

  it("suffixes produce valid slugs", () => {
    expect(withSuffix("maths", () => 0)).toBe("maths-0000");
    expect(withSuffix("maths", () => 0.999999)).toMatch(SLUG_RE);
  });
});

describe("regionalDefaults", () => {
  it("derives country, currency, locale and week start from the browser", () => {
    const d = regionalDefaults(["en-LK", "si"], "Asia/Colombo");
    expect(d).toMatchObject({
      country: "LK",
      currency: "LKR",
      timezone: "Asia/Colombo",
      defaultLocale: "en-LK",
    });
  });

  it("uses Sunday-start weeks where the locale does", () => {
    expect(regionalDefaults(["en-US"], "America/New_York").weekStart).toBe("0");
    expect(regionalDefaults(["en-GB"], "Europe/London").weekStart).toBe("1");
  });

  it("leaves country empty when the browser language has no region", () => {
    const d = regionalDefaults(["xx-invalid-@@"], "UTC");
    expect(d.country).toBe("");
    expect(d.currency).toBe("");
  });
});

describe("country data", () => {
  it("maps every country to a currency the runtime supports", () => {
    const supported = new Set(Intl.supportedValuesOf("currency"));
    const missing = COUNTRY_CODES.filter(
      (c) => !supported.has(COUNTRY_CURRENCY[c]!),
    );
    expect(missing).toEqual([]);
  });

  it("uses valid ISO 3166 codes that Intl can name", () => {
    const names = new Intl.DisplayNames(["en"], { type: "region" });
    for (const code of COUNTRY_CODES) {
      expect(code).toMatch(/^[A-Z]{2}$/);
      expect(names.of(code)).not.toBe(code);
    }
  });
});

describe("orgSettingsSchema", () => {
  const valid = {
    name: " Kamal's Classes ",
    kind: "institute",
    country: "LK",
    timezone: "Asia/Colombo",
    currency: "LKR",
    defaultLocale: "en-LK",
    weekStart: "1",
  };

  it("accepts and normalises valid input", () => {
    const r = orgSettingsSchema.parse(valid);
    expect(r.name).toBe("Kamal's Classes");
    expect(r.weekStart).toBe(1);
  });

  it.each([
    ["country", "ZZ", "invalidCountry"],
    ["timezone", "Mars/Olympus", "invalidTimezone"],
    ["currency", "XYZ1", "invalidCurrency"],
    ["defaultLocale", "not a locale!", "invalidLocale"],
    ["name", "   ", "required"],
    ["kind", "school", "required"],
  ])("rejects invalid %s", (field, value, key) => {
    const r = orgSettingsSchema.safeParse({ ...valid, [field]: value });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(key);
  });
});
