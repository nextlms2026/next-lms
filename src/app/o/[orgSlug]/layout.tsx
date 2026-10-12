import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AccountButton,
  AccountButtonSkeleton,
} from "@/components/app-shell/account-button";
import { OrgMobileNav, OrgSidebarNav } from "@/components/app-shell/org-nav";
import { getTranslations } from "next-intl/server";
import { requireOrgMember } from "@/server/authz";

// Sign-in gated: the auth redirect can never pass dev-time instant-navigation
// validation, so opt out of its feedback (content still streams behind Suspense).
export const instant = false;

/**
 * Staff app shell. Membership is verified before ANY org content renders;
 * each page also re-checks (layouts don't re-run on client navigation).
 */
export default function OrgLayout({
  children,
  params,
}: LayoutProps<"/o/[orgSlug]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <OrgShell params={params}>{children}</OrgShell>
    </Suspense>
  );
}

async function OrgShell({
  params,
  children,
}: {
  params: LayoutProps<"/o/[orgSlug]">["params"];
  children: React.ReactNode;
}) {
  const { orgSlug } = await params;
  const { org } = await requireOrgMember(orgSlug);
  const t = await getTranslations("orgs.kindLabel");

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-svh w-60 shrink-0 flex-col gap-6 border-e bg-sidebar p-4 md:flex">
        <Logo href="/dashboard" />
        <div className="grid gap-0.5 px-1">
          <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {t(org.kind)}
          </span>
          <span className="truncate font-medium">{org.name}</span>
        </div>
        <OrgSidebarNav orgSlug={org.slug} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <OrgMobileNav orgSlug={org.slug} orgName={org.name} />
          <span className="truncate font-medium md:hidden">{org.name}</span>
          <div className="ms-auto">
            <Suspense fallback={<AccountButtonSkeleton />}>
              <AccountButton />
            </Suspense>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex flex-1">
      <div className="hidden w-60 border-e bg-sidebar md:block" />
      <div className="flex-1 p-6">
        <Skeleton className="h-8 w-48" />
      </div>
    </div>
  );
}
