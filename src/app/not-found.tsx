import Link from "next/link";
import { SearchX } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

// Deliberately identical for "doesn't exist" and "no access" (no existence leaks).
export default async function NotFound() {
  const t = await getTranslations("notFound");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-16">
      <EmptyState
        icon={SearchX}
        title={t("title")}
        body={t("body")}
        action={
          <Button asChild variant="outline">
            <Link href="/dashboard">{t("home")}</Link>
          </Button>
        }
      />
    </main>
  );
}
