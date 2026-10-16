"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import type { FormState } from "@/lib/form-state";
import { signUp } from "../actions";

export function SignUpForm() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const [state, action, pending] = useActionState<FormState, FormData>(
    signUp,
    null,
  );
  const failed = state && !state.ok ? state : null;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <FormField
        name="fullName"
        label={t("fullName")}
        autoComplete="name"
        required
        defaultValue={failed?.values?.fullName}
        error={failed?.fieldErrors?.fullName}
      />
      <FormField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        defaultValue={failed?.values?.email}
        error={failed?.fieldErrors?.email}
      />
      <FormField
        name="password"
        type="password"
        label={t("password")}
        autoComplete="new-password"
        required
        minLength={8}
        hint={t("passwordHint")}
        error={failed?.fieldErrors?.password}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("signUp.pending") : t("signUp.submit")}
      </Button>
      <p className="text-xs text-muted-foreground">{t("signUp.terms")}</p>
    </form>
  );
}
