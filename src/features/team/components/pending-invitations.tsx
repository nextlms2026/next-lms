"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/forms/form-alert";
import type { FormState } from "@/lib/form-state";
import type { MemberRole } from "@/server/authz";
import { revokeInvitation } from "../actions";

export function PendingInvitations({
  orgSlug,
  invitations,
  callerRole,
}: {
  orgSlug: string;
  invitations: {
    id: string;
    email: string;
    role: MemberRole;
    expiresLabel: string;
  }[];
  callerRole: MemberRole;
}) {
  const t = useTranslations("team");
  const tr = useTranslations("orgs.roles");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormState>(null);

  if (invitations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">{t("pending.empty")}</p>
    );
  }

  return (
    <div className="grid gap-3">
      {result && !result.ok ? <FormAlert state={result} /> : null}
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
