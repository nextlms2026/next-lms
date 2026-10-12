"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// Items are added as their milestones ship (no placeholder links).
const ITEMS = [
  { key: "today", href: "", icon: CalendarCheck },
  { key: "settings", href: "/settings", icon: Settings },
] as const;

function NavLinks({
  orgSlug,
  onNavigate,
}: {
  orgSlug: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const base = `/o/${orgSlug}`;

  return (
    <nav className="grid gap-1">
      {ITEMS.map(({ key, href, icon: Icon }) => {
        const target = `${base}${href}`;
        const active =
          href === "" ? pathname === base : pathname.startsWith(target);
        return (
          <Link
            key={key}
            href={target}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:min-h-9",
              active && "bg-sidebar-accent text-sidebar-accent-foreground",
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}

export function OrgSidebarNav({ orgSlug }: { orgSlug: string }) {
  return <NavLinks orgSlug={orgSlug} />;
}

export function OrgMobileNav({
  orgSlug,
  orgName,
}: {
  orgSlug: string;
  orgName: string;
}) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          aria-label={t("menu")}
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle className="truncate text-start">{orgName}</SheetTitle>
        </SheetHeader>
        <NavLinks orgSlug={orgSlug} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
