import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { defaultLocale } from "@/i18n/config";
import { requireUser } from "@/server/authz";
import { createOrganization } from "@/features/orgs/actions";
import { getOrgFormOptions } from "@/features/orgs/options";
import { OrgSettingsForm } from "@/features/orgs/components/org-settings-form";

export const metadata: Metadata = { title: "Create your workspace" };

async function OnboardingForm() {
  await requireUser();
  return (
    <OrgSettingsForm
      mode="create"
      action={createOrganization}
      options={getOrgFormOptions(defaultLocale)}
      initial={{
        name: "",
        kind: "individual",
        country: "",
        timezone: "",
        currency: "",
        defaultLocale: "",
        weekStart: "",
      }}
    />
  );
}

export default async function OnboardingPage() {
  const t = await getTranslations("onboarding");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent>
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <OnboardingForm />
          </Suspense>
        </CardContent>
      </Card>
    </>
  );
}
