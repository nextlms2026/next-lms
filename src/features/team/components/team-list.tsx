"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { MoreHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FormAlert } from "@/components/forms/form-alert";
import type { FormState } from "@/lib/form-state";
import type { MemberRole } from "@/server/authz";
import type { TeamMember } from "../queries";
import { memberActions } from "../permissions";
import {
  changeMemberRole,
  leaveOrganization,
  setMemberStatus,
} from "../actions";

type Confirm = { kind: "deactivate" | "leave"; member: TeamMember } | null;

export function TeamList({
  orgSlug,
  members,
  caller,
}: {
  orgSlug: string;
  /** joinedLabel is formatted on the server in the org locale/time zone. */
  members: (TeamMember & { joinedLabel: string })[];
  caller: { role: MemberRole; membershipId: string };
}) {
  const t = useTranslations("team");
  const tr = useTranslations("orgs.roles");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormState>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const run = (fn: () => Promise<FormState | undefined>) =>
    startTransition(async () => {
      setResult((await fn()) ?? null);
    });

  return (
    <div className="grid gap-3">
      {result && !result.ok ? <FormAlert state={result} /> : null}
      <ul className="divide-y rounded-lg border bg-card" aria-busy={pending}>
        {members.map((m) => {
          const actions = memberActions(caller, m);
          const any =
            actions.changeRole ||
            actions.deactivate ||
            actions.reactivate ||
            actions.leave;
          const isSelf = m.membershipId === caller.membershipId;
          return (
            <li
              key={m.membershipId}
              className="flex items-center gap-3 px-4 py-3"
            >
              <div className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-medium">
                  {m.fullName || m.email || t("unnamed")}
                  {isSelf ? (
                    <span className="text-muted-foreground"> · {t("you")}</span>
                  ) : null}
                </span>
                {m.email ? (
                  <span className="truncate text-sm text-muted-foreground">
                    {m.email}
                  </span>
                ) : null}
                <span className="text-xs text-muted-foreground">
                  {t("joined", { date: m.joinedLabel })}
                </span>
              </div>
              {m.status === "inactive" ? (
                <Badge variant="outline">{t("inactive")}</Badge>
              ) : null}
              <Badge variant={m.role === "owner" ? "default" : "secondary"}>
                {tr(m.role)}
              </Badge>
              {any ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("actionsFor", {
                        // Email disambiguates members who share a name.
                        name: [m.fullName, m.email].filter(Boolean).join(" · "),
                      })}
                      disabled={pending}
                    >
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {actions.changeRole ? (
                      <>
                        <DropdownMenuLabel>{t("changeRole")}</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={m.role}
                          onValueChange={(role) =>
                            run(() =>
                              changeMemberRole(orgSlug, m.membershipId, role),
                            )
                          }
                        >
                          {(["owner", "admin", "teacher"] as const).map((r) => (
                            <DropdownMenuRadioItem key={r} value={r}>
                              {tr(r)}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                        <DropdownMenuSeparator />
                      </>
                    ) : null}
                    {actions.deactivate ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setConfirm({ kind: "deactivate", member: m })
                        }
                      >
                        {t("deactivate")}
                      </DropdownMenuItem>
                    ) : null}
                    {actions.reactivate ? (
                      <DropdownMenuItem
                        onSelect={() =>
                          run(() =>
                            setMemberStatus(orgSlug, m.membershipId, "active"),
                          )
                        }
                      >
                        {t("reactivate")}
                      </DropdownMenuItem>
                    ) : null}
                    {actions.leave ? (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() =>
                          setConfirm({ kind: "leave", member: m })
                        }
                      >
                        {t("leave")}
                      </DropdownMenuItem>
                    ) : null}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </li>
          );
        })}
      </ul>

      <AlertDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "leave"
                ? t("confirmLeave.title")
                : t("confirmDeactivate.title", {
                    name: confirm?.member.fullName ?? "",
                  })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "leave"
                ? t("confirmLeave.body")
                : t("confirmDeactivate.body")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const c = confirm;
                if (!c) return;
                run(() =>
                  c.kind === "leave"
                    ? leaveOrganization(orgSlug, c.member.membershipId)
                    : setMemberStatus(
                        orgSlug,
                        c.member.membershipId,
                        "inactive",
                      ),
                );
              }}
            >
              {confirm?.kind === "leave" ? t("leave") : t("deactivate")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
