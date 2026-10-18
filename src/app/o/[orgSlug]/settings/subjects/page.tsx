import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgMember } from "@/server/authz";
import { listSubjects } from "@/features/catalogue/queries";
import { CatalogueManager } from "@/features/catalogue/components/catalogue-manager";

export const metadata: Metadata = { title: "Subjects" };

async function Subjects({
  params,
}: {
  params: PageProps<"/o/[orgSlug]/settings/subjects">["params"];
}) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const [t, rows] = await Promise.all([
    getTranslations("catalogue.subjects"),
    listSubjects(org.id),
  ]);

  return (
    <CatalogueManager
      orgSlug={org.slug}
      kind="subjects"
      canManage={role === "owner" || role === "admin"}
      fields={[
        { name: "name", label: t("name"), required: true, maxLength: 80 },
        { name: "code", label: t("code"), hint: t("codeHint"), maxLength: 20 },
      ]}
      items={rows.map((r) => ({
        id: r.id,
        name: r.name,
        detail: r.code,
        archived: r.archivedAt !== null,
        values: { name: r.name, code: r.code ?? "" },
      }))}
    />
  );
}

export default async function SubjectsPage({
  params,
}: PageProps<"/o/[orgSlug]/settings/subjects">) {
  const t = await getTranslations("catalogue.subjects");
  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Subjects params={params} />
      </Suspense>
    </>
  );
}
