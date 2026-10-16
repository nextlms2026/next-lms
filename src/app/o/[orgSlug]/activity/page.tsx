import type { Metadata } from "next";
import { Suspense } from "react";
import { History } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { requireOrgMember } from "@/server/authz";
import { listAuditLog } from "@/features/team/queries";

export const metadata: Metadata = { title: "Activity" };

const KNOWN_ACTIONS = new Set([
  "invitation.created",
  "invitation.revoked",
  "invitation.accepted",
  "member.joined",
  "member.role_changed",
  "member.deactivated",
  "member.reactivated",
  "member.left",
]);

async function Activity({
  params,
}: {
  params: PageProps<"/o/[orgSlug]/activity">["params"];
}) {
  const { orgSlug } = await params;
  // Teachers get the generic 404 (ROLES-PERMISSIONS: audit log is owner/admin only).
  const { org } = await requireOrgMember(orgSlug, ["owner", "admin"]);
  const [t, tr, entries] = await Promise.all([
    getTranslations("activity"),
    getTranslations("orgs.roles"),
    listAuditLog(org.id),
  ]);
  if (entries.length === 0) {
    return <EmptyState icon={History} title={t("empty")} />;
  }

  const when = new Intl.DateTimeFormat(org.defaultLocale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: org.timezone,
  });
  const role = (v: unknown) =>
    v === "owner" || v === "admin" || v === "teacher" ? tr(v) : "";

  return (
    <ol className="divide-y rounded-lg border bg-card">
      {entries.map((e) => {
        const meta = (e.metadata ?? {}) as Record<string, unknown>;
        const key = KNOWN_ACTIONS.has(e.action)
          ? e.action.replace(".", "_")
          : "unknown";
        return (
          <li
            key={e.id}
            className="grid gap-0.5 px-4 py-3 sm:grid-cols-[1fr_auto] sm:gap-4"
          >
            <span>
              <span className="font-medium">{e.actorName || t("someone")}</span>{" "}
              {t(`actions.${key}`, {
                role: role(meta.role),
                from: role(meta.from),
                to: role(meta.to),
              })}
            </span>
            <time
              dateTime={e.createdAt.toISOString()}
              className="text-sm text-muted-foreground tabular-nums"
            >
              {when.format(e.createdAt)}
            </time>
          </li>
        );
      })}
    </ol>
  );
}

export default async function ActivityPage({
  params,
}: PageProps<"/o/[orgSlug]/activity">) {
  const t = await getTranslations("activity");
  return (
    <>
      <PageHeader title={t("title")} description={t("description")} />
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Activity params={params} />
      </Suspense>
    </>
  );
}
