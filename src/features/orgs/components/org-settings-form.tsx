"use client";

import { useActionState, useMemo, useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import {
  SelectField,
  type SelectOption,
} from "@/components/forms/select-field";
import { COUNTRY_CURRENCY } from "@/lib/geo/countries";
import type { FormState } from "@/lib/form-state";
import { regionalDefaults, type RegionalDefaults } from "../browser-defaults";
import type { OrgFormOptions } from "../options";

export type OrgFormValues = RegionalDefaults & { name: string; kind: string };

type Props = {
  mode: "create" | "edit";
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial: OrgFormValues;
  options: OrgFormOptions;
  readOnly?: boolean;
};

const SAMPLE_DATE = new Date(Date.UTC(2026, 11, 31, 14, 30));

type BrowserSnapshot = {
  languages: readonly string[];
  guess: RegionalDefaults;
};
let browserSnapshot: BrowserSnapshot | undefined;
const noopSubscribe = () => () => {};
const getServerSnapshot = () => null;
function getBrowserSnapshot(): BrowserSnapshot {
  browserSnapshot ??= {
    languages: navigator.languages?.length
      ? navigator.languages
      : [navigator.language],
    guess: regionalDefaults(
      navigator.languages?.length ? navigator.languages : [navigator.language],
      Intl.DateTimeFormat().resolvedOptions().timeZone,
    ),
  };
  return browserSnapshot;
}

export function OrgSettingsForm({
  mode,
  action,
  initial,
  options,
  readOnly,
}: Props) {
  const t = useTranslations("orgs.fields");
  const tc = useTranslations("common");
  const to = useTranslations("onboarding");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const failed = state && !state.ok ? state : null;
  const echoed = failed?.values;

  // Browser-derived values arrive after hydration via useSyncExternalStore
  // (server snapshot = null), so SSR and the first client render match.
  const browser = useSyncExternalStore(
    noopSubscribe,
    getBrowserSnapshot,
    getServerSnapshot,
  );

  const base: RegionalDefaults = {
    country: echoed?.country ?? initial.country,
    timezone: echoed?.timezone ?? initial.timezone,
    currency: echoed?.currency ?? initial.currency,
    defaultLocale: echoed?.defaultLocale ?? initial.defaultLocale,
    weekStart: echoed?.weekStart ?? initial.weekStart,
  };
  // Create mode: fill empty fields from the browser guess.
  const guess = mode === "create" ? browser?.guess : undefined;
  const [overrides, setOverrides] = useState<Partial<RegionalDefaults>>({});
  const regional: RegionalDefaults = {
    country: overrides.country ?? (base.country || guess?.country || ""),
    timezone: overrides.timezone ?? (base.timezone || guess?.timezone || ""),
    currency: overrides.currency ?? (base.currency || guess?.currency || ""),
    defaultLocale:
      overrides.defaultLocale ??
      (base.defaultLocale || guess?.defaultLocale || ""),
    weekStart:
      overrides.weekStart ?? (base.weekStart || guess?.weekStart || "1"),
  };

  const set = (key: keyof RegionalDefaults) => (value: string) =>
    setOverrides((cur) => ({ ...cur, [key]: value }));

  function onCountryChange(country: string) {
    setOverrides((cur) => ({
      ...cur,
      country,
      // Follow the country unless the user already picked something else.
      currency:
        !regional.currency ||
        regional.currency === COUNTRY_CURRENCY[regional.country]
          ? (COUNTRY_CURRENCY[country] ?? regional.currency)
          : regional.currency,
      defaultLocale:
        !regional.defaultLocale ||
        regional.defaultLocale === `en-${regional.country}`
          ? `en-${country}`
          : regional.defaultLocale,
    }));
  }

  const browserLocales = browser?.languages;
  const localeOptions = useMemo<SelectOption[]>(() => {
    const candidates = new Set<string>(
      [
        regional.defaultLocale,
        regional.country ? `en-${regional.country}` : "",
        ...(browserLocales ?? []),
        "en-GB",
        "en-US",
      ].filter(Boolean),
    );
    return [...candidates].flatMap((tag) => {
      try {
        const [canonical] = Intl.getCanonicalLocales(tag);
        if (!canonical) return [];
        // Sample dates only on the client: Node and browser ICU can format
        // slightly differently, which would break hydration.
        if (!browserLocales) return [{ value: canonical, label: canonical }];
        const sample = new Intl.DateTimeFormat(canonical, {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "UTC",
        }).format(SAMPLE_DATE);
        return [{ value: canonical, label: `${sample} (${canonical})` }];
      } catch {
        return [];
      }
    });
  }, [regional.defaultLocale, regional.country, browserLocales]);

  const placeholder = { value: "", label: "—" };

  return (
    <form action={formAction} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <fieldset disabled={readOnly || pending} className="grid gap-5">
        <FormField
          name="name"
          label={t("name")}
          hint={t("nameHint")}
          required
          maxLength={120}
          defaultValue={echoed?.name ?? initial.name}
          error={failed?.fieldErrors?.name}
        />
        <SelectField
          name="kind"
          label={t("kind")}
          defaultValue={echoed?.kind ?? initial.kind}
          options={[
            { value: "individual", label: t("kindIndividual") },
            { value: "institute", label: t("kindInstitute") },
          ]}
          error={failed?.fieldErrors?.kind}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="country"
            label={t("country")}
            value={regional.country}
            onChange={(e) => onCountryChange(e.target.value)}
            options={[placeholder, ...options.countries]}
            error={failed?.fieldErrors?.country}
          />
          <SelectField
            name="currency"
            label={t("currency")}
            value={regional.currency}
            onChange={(e) => set("currency")(e.target.value)}
            options={[placeholder, ...options.currencies]}
            error={failed?.fieldErrors?.currency}
          />
        </div>
        <SelectField
          name="timezone"
          label={t("timezone")}
          hint={t("timezoneHint")}
          value={regional.timezone}
          onChange={(e) => set("timezone")(e.target.value)}
          options={[placeholder, ...options.timezones]}
          error={failed?.fieldErrors?.timezone}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField
            name="defaultLocale"
            label={t("defaultLocale")}
            value={regional.defaultLocale}
            onChange={(e) => set("defaultLocale")(e.target.value)}
            options={localeOptions.length ? localeOptions : [placeholder]}
            error={failed?.fieldErrors?.defaultLocale}
          />
          <SelectField
            name="weekStart"
            label={t("weekStart")}
            value={regional.weekStart}
            onChange={(e) => set("weekStart")(e.target.value)}
            options={options.weekdays}
            error={failed?.fieldErrors?.weekStart}
          />
        </div>
      </fieldset>
      {readOnly ? null : (
        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="justify-self-start"
        >
          {mode === "create"
            ? pending
              ? to("pending")
              : to("submit")
            : pending
              ? tc("saving")
              : tc("save")}
        </Button>
      )}
    </form>
  );
}
