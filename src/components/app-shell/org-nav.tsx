"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { CalendarCheck, History, Menu, Settings, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type Role = "owner" | "admin" | "teacher";

// Items are added as their milestones ship (no placeholder links).
// `roles` only hides links; pages enforce access themselves.
const ITEMS: {
  key: "today" | "team" | "activity" | "settings";
  href: string;
  icon: typeof CalendarCheck;
  roles?: readonly Role[];
}[] = [
  { key: "today", href: "", icon: CalendarCheck },
  { key: "team", href: "/team", icon: Users },
  {
    key: "activity",
    href: "/activity",
    icon: History,
    roles: ["owner", "admin"],
  },
  { key: "settings", href: "/settings", icon: Settings },
];

function NavLinks({
  orgSlug,
  role,
  onNavigate,
}: {
  orgSlug: string;
  role: Role;
  onNavigate?: () => void;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const base = `/o/${orgSlug}`;

  return (
    <nav className="grid gap-1">
      {ITEMS.filter((i) => !i.roles || i.roles.includes(role)).map(
        ({ key, href, icon: Icon }) => {
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
        },
      )}
    </nav>
  );
}

export function OrgSidebarNav({
  orgSlug,
  role,
}: {
  orgSlug: string;
  role: Role;
}) {
  return <NavLinks orgSlug={orgSlug} role={role} />;
}

export function OrgMobileNav({
  orgSlug,
  orgName,
  role,
}: {
  orgSlug: string;
  orgName: string;
  role: Role;
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
        <NavLinks
          orgSlug={orgSlug}
          role={role}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
