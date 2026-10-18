import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Skeleton } from "@/components/ui/skeleton";
import { requireOrgMember } from "@/server/authz";
import { locationKinds } from "@/features/catalogue/schema";
import { listLocations } from "@/features/catalogue/queries";
import { CatalogueManager } from "@/features/catalogue/components/catalogue-manager";

export const metadata: Metadata = { title: "Locations" };

async function Locations({
  params,
}: {
  params: PageProps<"/o/[orgSlug]/settings/locations">["params"];
}) {
  const { orgSlug } = await params;
  const { org, role } = await requireOrgMember(orgSlug);
  const [t, rows] = await Promise.all([
    getTranslations("catalogue.locations"),
    listLocations(org.id),
  ]);

  return (
    <CatalogueManager
      orgSlug={org.slug}
      kind="locations"
      canManage={role === "owner" || role === "admin"}
      fields={[
        { name: "name", label: t("name"), required: true, maxLength: 80 },
        {
          name: "kind",
          label: t("kind"),
          options: locationKinds.map((k) => ({
            value: k,
            label: t(`kinds.${k}`),
          })),
        },
        {
          name: "address",
          label: t("address"),
          hint: t("addressHint"),
          maxLength: 300,
        },
      ]}
      items={rows.map((r) => ({
        id: r.id,
        name: r.name,
        detail: [t(`kinds.${r.kind}`), r.address].filter(Boolean).join(" · "),
        archived: r.archivedAt !== null,
        values: { name: r.name, kind: r.kind, address: r.address ?? "" },
      }))}
    />
  );
}

export default async function LocationsPage({
  params,
}: PageProps<"/o/[orgSlug]/settings/locations">) {
  const t = await getTranslations("catalogue.locations");
  return (
    <>
      <p className="mb-4 max-w-prose text-sm text-muted-foreground">
        {t("description")}
      </p>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <Locations params={params} />
      </Suspense>
    </>
  );
}
