import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarDays } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { requireOrgMember } from "@/server/authz";
import { getMyProfile } from "@/features/profile/queries";

export const metadata: Metadata = { title: "Today" };

async function Today({
  params,
}: {
  params: PageProps<"/o/[orgSlug]">["params"];
}) {
  const { orgSlug } = await params;
  const { org } = await requireOrgMember(orgSlug);
  const [t, profile] = await Promise.all([
    getTranslations("today"),
    getMyProfile(),
  ]);
  const firstName = profile.fullName.split(/\s+/)[0];

  const dateLabel = new Intl.DateTimeFormat(org.defaultLocale, {
    dateStyle: "full",
    timeZone: org.timezone,
  }).format(new Date());

  return (
    <>
      <PageHeader
        title={
          firstName ? t("greeting", { name: firstName }) : t("greetingNoName")
        }
        description={dateLabel}
      />
      <EmptyState
        icon={CalendarDays}
        title={t("emptyTitle")}
        body={t("emptyBody")}
      />
    </>
  );
}

export default function TodayPage({ params }: PageProps<"/o/[orgSlug]">) {
  return (
    <Suspense fallback={<Skeleton className="h-48 w-full" />}>
      <Today params={params} />
    </Suspense>
  );
}
