import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { listMyOrganizations } from "@/features/orgs/queries";

export const metadata: Metadata = { title: "Your workspaces" };

async function OrgList() {
  const t = await getTranslations("orgs");
  const orgs = await listMyOrganizations();
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {orgs.map((org) => (
        <li key={org.slug}>
          <Link
            href={`/o/${org.slug}`}
            className="flex min-h-14 items-center justify-between gap-4 px-4 py-3 hover:bg-muted/50"
          >
            <span className="grid">
              <span className="font-medium">{org.name}</span>
              <span className="text-sm text-muted-foreground">
                {t(`roles.${org.role}`)}
              </span>
            </span>
            <ChevronRight
              className="size-4 text-muted-foreground rtl:rotate-180"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function OrgsPage() {
  const t = await getTranslations("orgs");
  return (
    <>
      <PageHeader
        title={t("pickerTitle")}
        description={t("pickerDescription")}
        action={
          <Button asChild variant="outline">
            <Link href="/onboarding">
              <Plus />
              {t("createAnother")}
            </Link>
          </Button>
        }
      />
      <Suspense fallback={<Skeleton className="h-40 w-full" />}>
        <OrgList />
      </Suspense>
    </>
  );
}
