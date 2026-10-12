import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { getMyProfile } from "@/features/profile/queries";
import { ProfileForm } from "@/features/profile/components/profile-form";

export const metadata: Metadata = { title: "Your account" };

async function AccountForm() {
  const profile = await getMyProfile();
  return <ProfileForm {...profile} />;
}

export default async function AccountPage() {
  const t = await getTranslations("account");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Card>
        <CardContent className="grid gap-6">
          <Suspense fallback={<Skeleton className="h-64 w-full" />}>
            <AccountForm />
          </Suspense>
          <p className="text-sm text-muted-foreground">{t("changePassword")}</p>
        </CardContent>
      </Card>
    </>
  );
}
