import { getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { acceptInvitationById } from "../actions";
import { listMyPendingInvitations } from "../queries";
import { AcceptInvitationButton } from "./accept-invitation";

/** Invitations addressed to the signed-in user's email — no link needed. Render inside <Suspense>. */
export async function MyInvitations() {
  const invitations = await listMyPendingInvitations();
  if (invitations.length === 0) return null;
  const t = await getTranslations("team");
  const tr = await getTranslations("orgs.roles");

  return (
    <Card className="mb-6 border-primary/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="size-4 text-primary" aria-hidden />
          {t("mine.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-3">
          {invitations.map((inv) => (
            <li
              key={inv.id}
              className="flex flex-wrap items-center justify-between gap-3"
            >
              <span>
                {t("mine.item", { org: inv.orgName, role: tr(inv.role) })}
              </span>
              <AcceptInvitationButton
                size="sm"
                action={acceptInvitationById.bind(null, inv.id)}
              />
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
