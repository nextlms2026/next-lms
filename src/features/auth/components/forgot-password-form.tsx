"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import type { FormState } from "@/lib/form-state";
import { requestPasswordReset } from "../actions";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [state, action, pending] = useActionState<FormState, FormData>(
    requestPasswordReset,
    null,
  );
  const failed = state && !state.ok ? state : null;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormAlert state={state} />
      <FormField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        error={failed?.fieldErrors?.email}
      />
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("forgot.pending") : t("forgot.submit")}
      </Button>
    </form>
  );
}
