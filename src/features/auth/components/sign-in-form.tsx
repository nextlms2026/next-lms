"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import type { FormState } from "@/lib/form-state";
import { signIn } from "../actions";

export function SignInForm() {
  const t = useTranslations("auth");
  const params = useSearchParams();
  const [state, action, pending] = useActionState<FormState, FormData>(
    signIn,
    null,
  );
  const failed = state && !state.ok ? state : null;

  return (
    <form action={action} className="grid gap-4" noValidate>
      {!state && params.get("error") === "link" ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t("signIn.linkError")}</AlertDescription>
        </Alert>
      ) : null}
      {!state && params.get("error") === "oauth" ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{t("google.failed")}</AlertDescription>
        </Alert>
      ) : null}
      {!state && params.get("notice") === "confirmed" ? (
        <Alert role="status">
          <CircleCheck className="text-success" />
          <AlertDescription>{t("signIn.confirmedNotice")}</AlertDescription>
        </Alert>
      ) : null}
      <FormAlert state={state} />
      <input type="hidden" name="next" value={params.get("next") ?? ""} />
      <FormField
        name="email"
        type="email"
        label={t("email")}
        autoComplete="email"
        required
        defaultValue={failed?.values?.email}
        error={failed?.fieldErrors?.email}
      />
      <div className="grid gap-1.5">
        <FormField
          name="password"
          type="password"
          label={t("password")}
          autoComplete="current-password"
          required
          error={failed?.fieldErrors?.password}
        />
        <Link
          href="/forgot-password"
          className="justify-self-end text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {t("signIn.forgot")}
        </Link>
      </div>
      <Button type="submit" size="lg" disabled={pending}>
        {pending ? t("signIn.pending") : t("signIn.submit")}
      </Button>
    </form>
  );
}
