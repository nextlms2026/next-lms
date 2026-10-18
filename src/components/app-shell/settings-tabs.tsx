"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "organisation", href: "" },
  { key: "subjects", href: "/subjects" },
  { key: "grades", href: "/grades" },
  { key: "locations", href: "/locations" },
] as const;

/** Settings sub-navigation. Pages enforce their own access. */
export function SettingsTabs() {
  const t = useTranslations("settings.tabs");
  const pathname = usePathname();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const base = `/o/${orgSlug}/settings`;

  return (
    <nav
      aria-label={t("label")}
      className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b"
    >
      {TABS.map(({ key, href }) => {
        const target = `${base}${href}`;
        const active = pathname === target;
        return (
          <Link
            key={key}
            href={target}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px shrink-0 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              active ? "border-primary text-foreground" : "border-transparent",
            )}
          >
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
