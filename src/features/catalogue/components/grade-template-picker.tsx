"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectField } from "@/components/forms/select-field";
import type { FormState } from "@/lib/form-state";
import {
  GRADE_TEMPLATES,
  GRADE_TEMPLATE_IDS,
  type GradeTemplateId,
} from "../grade-templates";

/** Shown while an org has no grade levels: seed from a template, or add manually below. */
export function GradeTemplatePicker({
  action,
  suggested,
}: {
  action: (s: FormState, f: FormData) => Promise<FormState>;
  suggested: GradeTemplateId;
}) {
  const t = useTranslations("catalogue.grades.template");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-lg border border-primary/40 bg-card p-4"
      noValidate
    >
      <div className="grid gap-1">
        <h2 className="font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>
      <FormAlert state={state} />
      <SelectField
        name="template"
        label={t("label")}
        defaultValue={suggested}
        options={GRADE_TEMPLATE_IDS.map((id) => {
          const names = GRADE_TEMPLATES[id];
          return {
            value: id,
            label: `${t(`names.${id}`)} — ${names[0]} … ${names.at(-1)}`,
          };
        })}
      />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("pending") : t("submit")}
      </Button>
    </form>
  );
}
