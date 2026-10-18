import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgMember } from "@/server/authz";
import { seedGradeLevels } from "@/features/catalogue/actions";
import { suggestGradeTemplate } from "@/features/catalogue/grade-templates";
import { listGradeLevels } from "@/features/catalogue/queries";
import { CatalogueManager } from "@/features/catalogue/components/catalogue-manager";
import { GradeTemplatePicker } from "@/features/catalogue/components/grade-template-picker";

export const metadata: Metadata = { title: "Grade levels" };

async function Grades({
  params,
}: {
  params: PageProps<"/o/[orgSlug]/settings/grades">["params"];
}) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const [t, rows] = await Promise.all([
    getTranslations("catalogue.grades"),
    listGradeLevels(org.id),
  ]);
  const canManage = role === "owner" || role === "admin";
  const hasActive = rows.some((r) => r.archivedAt === null);

  return (
    <div className="grid gap-6">
      {canManage && !hasActive ? (
        <GradeTemplatePicker
          action={seedGradeLevels.bind(null, org.slug)}
          suggested={suggestGradeTemplate(org.country)}
        />
      ) : null}
      <CatalogueManager
        orgSlug={org.slug}
        kind="grades"
        canManage={canManage}
        reorderable
        fields={[
          { name: "name", label: t("name"), required: true, maxLength: 60 },
        ]}
        items={rows.map((r) => ({
          id: r.id,
          name: r.name,
          archived: r.archivedAt !== null,
          values: { name: r.name },
        }))}
      />
    </div>
  );
}

export default async function GradesPage({
  params,
}: PageProps<"/o/[orgSlug]/settings/grades">) {
  const t = await getTranslations("catalogue.grades");
  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Grades params={params} />
      </Suspense>
    </>
  );
}
