"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import type { FormState } from "@/lib/form-state";

/** One-button form; `action` is a server action pre-bound to the token or id. */
export function AcceptInvitationButton({
  action,
  size = "lg",
}: {
  action: (state: FormState) => Promise<FormState>;
  size?: "lg" | "sm";
}) {
  const t = useTranslations("team.accept");
  const [state, formAction, pending] = useActionState<FormState>(action, null);
  return (
    <form action={formAction} className="grid gap-3">
      <FormAlert state={state} />
      <Button type="submit" size={size} disabled={pending}>
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}
