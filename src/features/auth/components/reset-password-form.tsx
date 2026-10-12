"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import type { FormState } from "@/lib/form-state";
import { updatePassword } from "../actions";

export function ResetPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<FormState, FormData>(
    updatePassword,
    null,
  );
  const failed = state && !state.ok ? state : null;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <FormField
        name="password"
        type="password"
        label={t("newPassword")}
        autoComplete="new-password"
        required
        minLength={8}
        hint={t("passwordHint")}
        error={failed?.fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label={t("confirmPassword")}
        autoComplete="new-password"
        required
        error={failed?.fieldErrors?.confirmPassword}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("reset.pending") : t("reset.submit")}
      </Button>
    </form>
  );
}
