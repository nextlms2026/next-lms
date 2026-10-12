"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { FormState } from "@/lib/form-state";

/** Form-level error or success message for a FormState. */
export function FormAlert({ state }: { state: FormState }) {
  const tErrors = useTranslations("errors");
  const tMessages = useTranslations("messages");
  if (!state) return null;

  if (!state.ok && state.error) {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert />
        <AlertDescription>{tErrors(state.error)}</AlertDescription>
      </Alert>
    );
  }
  if (state.ok && state.message) {
    return (
      <Alert role="status">
        <CircleCheck className="text-success" />
        <AlertDescription>{tMessages(state.message)}</AlertDescription>
      </Alert>
    );
  }
  return null;
}
