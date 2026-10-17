"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Check,
  Copy,
  MailCheck,
  MessageCircle,
  TriangleAlert,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import { SelectField } from "@/components/forms/select-field";
import type { FormState } from "@/lib/form-state";
import { whatsappShareUrl } from "../share";

type Props = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  roles: readonly ("admin" | "teacher")[];
  orgName: string;
  /** Outgoing email configured: the button sends instead of only creating a link. */
  emailEnabled: boolean;
};

export function InviteForm({ action, roles, orgName, emailEnabled }: Props) {
  const t = useTranslations("team");
  const tr = useTranslations("orgs.roles");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const [formKey, setFormKey] = useState(0);
  const failed = state && !state.ok ? state : null;
  const link = state?.ok ? state.data?.link : undefined;

  if (link && state?.ok) {
    const shareText = t("invite.shareText", { org: orgName, link });
    const values = {
      email: state.data?.email ?? "",
      role: tr(state.data?.role ?? "teacher"),
    };
    const emailed = state.data?.emailed === "true";
    const emailEnabled = state.data?.emailEnabled === "true";
    return (
      <div className="grid gap-4">
        {emailed ? (
          <Alert role="status">
            <MailCheck className="text-success" />
            <AlertDescription>{t("invite.emailed", values)}</AlertDescription>
          </Alert>
        ) : emailEnabled ? (
          <Alert role="alert">
            <TriangleAlert className="text-warning" />
            <AlertDescription>
              {t("invite.emailFailed", values)}
            </AlertDescription>
          </Alert>
        ) : (
          <p className="text-sm">{t("invite.created", values)}</p>
        )}
        {emailed ? (
          <p className="text-sm text-muted-foreground">{t("invite.orShare")}</p>
        ) : null}
        <div className="flex gap-2">
          <Input
            value={link}
            readOnly
            aria-label={t("invite.linkLabel")}
            className="font-mono text-xs"
          />
          <CopyButton value={link} />
        </div>
        <p className="text-sm text-muted-foreground">{t("invite.linkHint")}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a
              href={whatsappShareUrl(shareText)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <MessageCircle />
              {t("invite.whatsapp")}
            </a>
          </Button>
          <Button variant="ghost" onClick={() => setFormKey((k) => k + 1)}>
            {t("invite.another")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      action={formAction}
      className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
      noValidate
    >
      <div className="sm:col-span-3">
        <FormAlert state={failed} />
      </div>
      <FormField
        name="email"
        type="email"
        label={t("invite.email")}
        autoComplete="off"
        required
        defaultValue={failed?.values?.email}
        error={failed?.fieldErrors?.email}
      />
      <SelectField
        name="role"
        label={t("invite.role")}
        defaultValue={failed?.values?.role ?? "teacher"}
        options={roles.map((r) => ({ value: r, label: tr(r) }))}
        error={failed?.fieldErrors?.role}
      />
      <Button type="submit" disabled={pending}>
        {pending
          ? t("invite.pending")
          : emailEnabled
            ? t("invite.submitEmail")
            : t("invite.submit")}
      </Button>
    </form>
  );
}

function CopyButton({ value }: { value: string }) {
  const t = useTranslations("team.invite");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? t("copied") : t("copy")}
    </Button>
  );
}
