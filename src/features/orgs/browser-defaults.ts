import { COUNTRY_CURRENCY, isCountryCode } from "@/lib/geo/countries";

export type RegionalDefaults = {
  country: string;
  timezone: string;
  currency: string;
  defaultLocale: string;
  weekStart: string;
};

type WeekInfo = { firstDay: number };
type LocaleWithWeekInfo = Intl.Locale & {
  getWeekInfo?: () => WeekInfo;
  weekInfo?: WeekInfo;
};

/**
 * Best-guess regional settings from the browser, used only to PREFILL the
 * onboarding form. Pure apart from its inputs, so it is unit-testable.
 */
export function regionalDefaults(
  languages: readonly string[],
  timezone: string,
): RegionalDefaults {
  const primary = languages[0] ?? "en";
  let country = "";
  let weekStart = 1; // Monday (ISO 8601) when unknown
  try {
    const locale = new Intl.Locale(primary).maximize() as LocaleWithWeekInfo;
    if (locale.region && isCountryCode(locale.region)) country = locale.region;
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    // Intl: 1 = Monday … 7 = Sunday. Ours: 0 = Sunday … 6 = Saturday.
    if (info) weekStart = info.firstDay % 7;
  } catch {
    // Unusual browser language tag: keep fallbacks.
  }
  return {
    country,
    timezone,
    currency: country ? (COUNTRY_CURRENCY[country] ?? "") : "",
    defaultLocale: country ? `en-${country}` : "en",
    weekStart: String(weekStart),
  };
}
