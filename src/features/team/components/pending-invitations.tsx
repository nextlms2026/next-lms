"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import type { FormState } from "@/lib/form-state";
import type { MemberRole } from "@/server/authz";
import { resendInvitation, revokeInvitation } from "../actions";

export function PendingInvitations({
  orgSlug,
  invitations,
  callerRole,
  emailEnabled,
}: {
  orgSlug: string;
  invitations: {
    id: string;
    email: string;
    role: MemberRole;
    expiresLabel: string;
  }[];
  callerRole: MemberRole;
  /** Show "Resend" only when outgoing email is configured. */
  emailEnabled: boolean;
}) {
  const t = useTranslations("team");
  const tr = useTranslations("orgs.roles");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("pending.empty")}</p>
    );
  }

  return (
    <div className="grid gap-3">
      {result && !result.ok ? <FormAlert state={result} /> : null}
      {notice ? (
        <p role="status" className="text-sm text-success">
          {notice}
        </p>
      ) : null}
      <ul className="divide-y rounded-lg border bg-card">
        {invitations.map((inv) => (
          <li
            key={inv.id}
            className="flex flex-wrap items-center gap-3 px-4 py-3"
          >
            <div className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{inv.email}</span>
              <span className="text-xs text-muted-foreground">
                {t("pending.expires", { date: inv.expiresLabel })}
              </span>
            </div>
            <Badge variant="secondary">{tr(inv.role)}</Badge>
            {(callerRole === "owner" || inv.role === "teacher") &&
            emailEnabled ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setNotice(null);
                    const r = await resendInvitation(orgSlug, inv.id);
                    setResult(r);
                    if (r?.ok) {
                      setNotice(
                        r.data?.emailed === "true"
                          ? t("pending.resent", { email: inv.email })
                          : t("pending.resendFailed"),
                      );
                    }
                  })
                }
              >
                {t("pending.resend")}
              </Button>
            ) : null}
            {callerRole === "owner" || inv.role === "teacher" ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setResult(await revokeInvitation(orgSlug, inv.id));
                  })
                }
              >
                {t("pending.revoke")}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t("pending.resendHint")}</p>
    </div>
  );
}
