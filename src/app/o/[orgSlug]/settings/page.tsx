import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { defaultLocale } from "@/i18n/config";
import { requireOrgMember } from "@/server/authz";
import { updateOrganization } from "@/features/orgs/actions";
import { getOrgFormOptions } from "@/features/orgs/options";
import { OrgSettingsForm } from "@/features/orgs/components/org-settings-form";

export const metadata: Metadata = { title: "Settings" };

async function Settings({
  params,
}: {
  params: PageProps<"/o/[orgSlug]/settings">["params"];
}) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const t = await getTranslations("settings");
  const isOwner = role === "owner";

  return (
    <Card>
      <CardContent className="grid gap-4">
        {isOwner ? null : (
          <p className="text-sm text-muted-foreground">{t("readOnly")}</p>
        )}
        <OrgSettingsForm
          mode="edit"
          readOnly={!isOwner}
          action={updateOrganization.bind(null, org.slug)}
          options={getOrgFormOptions(defaultLocale)}
          initial={{
            name: org.name,
            kind: org.kind,
            country: org.country,
            timezone: org.timezone,
            currency: org.currency,
            defaultLocale: org.defaultLocale,
            weekStart: String(org.weekStart),
          }}
        />
      </CardContent>
    </Card>
  );
}

export default async function SettingsPage({
  params,
}: PageProps<"/o/[orgSlug]/settings">) {
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Settings params={params} />
      </Suspense>
    </>
  );
}
