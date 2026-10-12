"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import type { FormState } from "@/lib/form-state";
import { updateProfile } from "../actions";

export function ProfileForm({
  email,
  fullName,
  phone,
}: {
  email: string;
  fullName: string;
  phone: string | null;
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState<FormState, FormData>(
    updateProfile,
    null,
  );
  const failed = state && !state.ok ? state : null;

  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormAlert state={state} />
      <FormField
        name="email"
        label={t("auth.email")}
        value={email}
        readOnly
        disabled
      />
      <FormField
        name="fullName"
        label={t("auth.fullName")}
        autoComplete="name"
        required
        maxLength={120}
        defaultValue={failed?.values?.fullName ?? fullName}
        error={failed?.fieldErrors?.fullName}
      />
      <FormField
        name="phone"
        type="tel"
        label={t("account.phone")}
        hint={t("account.phoneHint")}
        autoComplete="tel"
        inputMode="tel"
        defaultValue={failed?.values?.phone ?? phone ?? ""}
        error={failed?.fieldErrors?.phone}
      />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("common.saving") : t("common.save")}
      </Button>
    </form>
  );
}
