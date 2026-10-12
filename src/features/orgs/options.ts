import "server-only";
import { COUNTRY_CODES } from "@/lib/geo/countries";
import type { SelectOption } from "@/components/forms/select-field";

export type OrgFormOptions = {
  countries: SelectOption[];
  timezones: SelectOption[];
  currencies: SelectOption[];
  weekdays: SelectOption[];
};

/**
 * Option lists for the org settings form, built on the server so the client
 * renders exactly the same list (no hydration mismatch between ICU versions).
 */
export function getOrgFormOptions(displayLocale: string): OrgFormOptions {
  const regionNames = new Intl.DisplayNames([displayLocale], {
    type: "region",
  });
  const currencyNames = new Intl.DisplayNames([displayLocale], {
    type: "currency",
  });
  const collator = new Intl.Collator(displayLocale);

  const countries = COUNTRY_CODES.map((code) => ({
    value: code,
    label: regionNames.of(code) ?? code,
  })).sort((a, b) => collator.compare(a.label, b.label));

  const timezones = Intl.supportedValuesOf("timeZone").map((tz) => ({
    value: tz,
    label: tz.replaceAll("_", " "),
  }));

  const currencies = Intl.supportedValuesOf("currency")
    .map((code) => ({
      value: code,
      label: `${code} — ${currencyNames.of(code) ?? code}`,
    }))
    .sort((a, b) => a.value.localeCompare(b.value));

  // 2023-01-01 was a Sunday → index 0 = Sunday, matching organizations.week_start.
  const weekdayFormat = new Intl.DateTimeFormat(displayLocale, {
    weekday: "long",
    timeZone: "UTC",
  });
  const weekdays = Array.from({ length: 7 }, (_, i) => ({
    value: String(i),
    label: weekdayFormat.format(new Date(Date.UTC(2023, 0, 1 + i))),
  }));

  return { countries, timezones, currencies, weekdays };
}
