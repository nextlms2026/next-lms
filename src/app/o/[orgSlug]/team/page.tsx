import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { requireOrgMember } from "@/server/authz";
import { createInvitation } from "@/features/team/actions";
import { invitableRoles } from "@/features/team/permissions";
import { listPendingInvitations, listTeam } from "@/features/team/queries";
import { InviteForm } from "@/features/team/components/invite-form";
import { PendingInvitations } from "@/features/team/components/pending-invitations";
import { TeamList } from "@/features/team/components/team-list";

export const metadata: Metadata = { title: "Team" };

async function Team({
  params,
}: {
  params: PageProps<"/o/[orgSlug]/team">["params"];
}) {
  const { orgSlug } = await params;
  const { org, role, membershipId } = await requireOrgMember(orgSlug);
  const t = await getTranslations("team");
  const isManager = role === "owner" || role === "admin";

  const [members, invitations] = await Promise.all([
    listTeam(org.id),
    isManager ? listPendingInvitations(org.id) : Promise.resolve([]),
  ]);
  const date = new Intl.DateTimeFormat(org.defaultLocale, {
    dateStyle: "medium",
    timeZone: org.timezone,
  });

  return (
    <div className="grid gap-8">
      {isManager ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("invite.title")}</CardTitle>
          </CardHeader>
          <CardContent>
            <InviteForm
              action={createInvitation.bind(null, org.slug)}
              roles={invitableRoles(role)}
              orgName={org.name}
            />
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">{t("members")}</h2>
        <TeamList
          orgSlug={org.slug}
          caller={{ role, membershipId }}
          members={members.map((m) => ({
            ...m,
            joinedLabel: date.format(new Date(m.joinedAt)),
          }))}
        />
      </section>

      {isManager ? (
        <section className="grid gap-3">
          <h2 className="text-lg font-semibold">{t("pending.title")}</h2>
          <PendingInvitations
            orgSlug={org.slug}
            callerRole={role}
            invitations={invitations.map((i) => ({
              ...i,
              expiresLabel: date.format(i.expiresAt),
            }))}
          />
        </section>
      ) : null}
    </div>
  );
}

export default async function TeamPage({
  params,
}: PageProps<"/o/[orgSlug]/team">) {
  const t = await getTranslations("team");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Team params={params} />
      </Suspense>
    </>
  );
}
