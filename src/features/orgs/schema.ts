import { z } from "zod";
import { isCountryCode } from "@/lib/geo/countries";

// Messages are i18n keys under `errors.*` (messages/en.json).

const supportedTimezones = new Set(Intl.supportedValuesOf("timeZone"));
const supportedCurrencies = new Set(Intl.supportedValuesOf("currency"));

function isLocale(v: string): boolean {
  try {
    return Intl.getCanonicalLocales(v).length === 1;
  } catch {
    return false;
  }
}

export const orgSettingsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(120, { error: "tooLong" }),
  kind: z.enum(["individual", "institute"], { error: "required" }),
  country: z.string().refine(isCountryCode, { error: "invalidCountry" }),
  timezone: z
    .string()
    .refine((v) => supportedTimezones.has(v), { error: "invalidTimezone" }),
  currency: z
    .string()
    .refine((v) => supportedCurrencies.has(v), { error: "invalidCurrency" }),
  defaultLocale: z.string().refine(isLocale, { error: "invalidLocale" }),
  weekStart: z.coerce
    .number({ error: "required" })
    .int()
    .min(0, { error: "required" })
    .max(6, { error: "required" }),
});

export type OrgSettingsInput = z.infer<typeof orgSettingsSchema>;

export const ORG_SETTINGS_FIELDS = [
  "name",
  "kind",
  "country",
  "timezone",
  "currency",
  "defaultLocale",
  "weekStart",
] as const;
