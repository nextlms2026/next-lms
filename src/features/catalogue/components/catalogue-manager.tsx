"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { FormField } from "@/components/forms/form-field";
import {
  SelectField,
  type SelectOption,
} from "@/components/forms/select-field";
import type { FormState } from "@/lib/form-state";
import type { CatalogueKind } from "../schema";
import {
  createCatalogueItem,
  moveGradeLevel,
  setCatalogueArchived,
  updateCatalogueItem,
} from "../actions";

export type FieldDef = {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  maxLength?: number;
  options?: SelectOption[]; // present → <select>
};

export type CatalogueItem = {
  id: string;
  name: string;
  detail?: string | null;
  archived: boolean;
  values: Record<string, string>;
};

type Props = {
  orgSlug: string;
  kind: CatalogueKind;
  canManage: boolean;
  fields: FieldDef[];
  items: CatalogueItem[];
  reorderable?: boolean;
};

export function CatalogueManager({
  orgSlug,
  kind,
  canManage,
  fields,
  items,
  reorderable,
}: Props) {
  const t = useTranslations("catalogue");
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<CatalogueItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<FormState>(null);

  const active = items.filter((i) => !i.archived);
  const archived = items.filter((i) => i.archived);
  const visible = showArchived ? items : active;
  const listSignature = items
    .map((i) => `${i.id}:${i.name}:${i.archived}`)
    .join("|");

  const run = (fn: () => Promise<FormState>) =>
    startTransition(async () => setResult(await fn()));

  return (
    <div className="grid gap-6">
      {canManage ? (
        <AddForm
          // Remount (clearing stale errors/values) whenever the list changes.
          key={listSignature}
          fields={fields}
          action={createCatalogueItem.bind(null, orgSlug, kind)}
          submitLabel={t(`${kind}.add`)}
        />
      ) : null}

      {result && !result.ok ? <FormAlert state={result} /> : null}

      {visible.length === 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          {t(`${kind}.empty`)}
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card" aria-busy={pending}>
          {visible.map((item) => {
            const index = active.findIndex((a) => a.id === item.id);
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 px-4 py-3"
              >
                <div className="grid min-w-0 flex-1">
                  <span
                    className={
                      item.archived
                        ? "text-muted-foreground line-through"
                        : "font-medium"
                    }
                  >
                    {item.name}
                  </span>
                  {item.detail ? (
                    <span className="truncate text-sm text-muted-foreground">
                      {item.detail}
                    </span>
                  ) : null}
                </div>
                {item.archived ? (
                  <Badge variant="outline">{t("archived")}</Badge>
                ) : null}
                {canManage && reorderable && !item.archived ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === 0}
                      aria-label={t("moveUp", { name: item.name })}
                      onClick={() =>
                        run(() => moveGradeLevel(orgSlug, item.id, "up"))
                      }
                    >
                      <ArrowUp />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={pending || index === active.length - 1}
                      aria-label={t("moveDown", { name: item.name })}
                      onClick={() =>
                        run(() => moveGradeLevel(orgSlug, item.id, "down"))
                      }
                    >
                      <ArrowDown />
                    </Button>
                  </>
                ) : null}
                {canManage && !item.archived ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("editItem", { name: item.name })}
                    onClick={() => setEditing(item)}
                  >
                    <Pencil />
                  </Button>
                ) : null}
                {canManage ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        setCatalogueArchived(
                          orgSlug,
                          kind,
                          item.id,
                          !item.archived,
                        ),
                      )
                    }
                  >
                    {item.archived ? t("restore") : t("archive")}
                  </Button>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {archived.length > 0 ? (
        <Button
          variant="link"
          className="justify-self-start px-0"
          onClick={() => setShowArchived((v) => !v)}
        >
          {showArchived
            ? t("hideArchived")
            : t("showArchived", { count: archived.length })}
        </Button>
      ) : null}
      {canManage ? (
        <p className="text-xs text-muted-foreground">{t("archiveHint")}</p>
      ) : null}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t(`${kind}.edit`)}</DialogTitle>
          </DialogHeader>
          {editing ? (
            <EditForm
              key={editing.id}
              fields={fields}
              item={editing}
              action={updateCatalogueItem.bind(null, orgSlug, kind, editing.id)}
              onSaved={() => setEditing(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fields({
  fields,
  state,
  defaults,
}: {
  fields: FieldDef[];
  state: FormState;
  defaults?: Record<string, string>;
}) {
  const failed = state && !state.ok ? state : null;
  return (
    <>
      {fields.map((f) =>
        f.options ? (
          <SelectField
            key={f.name}
            name={f.name}
            label={f.label}
            options={f.options}
            defaultValue={
              failed?.values?.[f.name] ??
              defaults?.[f.name] ??
              f.options[0]?.value
            }
            error={failed?.fieldErrors?.[f.name]}
          />
        ) : (
          <FormField
            key={f.name}
            name={f.name}
            label={f.label}
            hint={f.hint}
            required={f.required}
            maxLength={f.maxLength}
            defaultValue={failed?.values?.[f.name] ?? defaults?.[f.name] ?? ""}
            error={failed?.fieldErrors?.[f.name]}
          />
        ),
      )}
    </>
  );
}

function AddForm({
  fields,
  action,
  submitLabel,
}: {
  fields: FieldDef[];
  action: (s: FormState, f: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const t = useTranslations("common");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-lg border bg-card p-4"
      noValidate
    >
      {state && !state.ok ? <FormAlert state={state} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Fields fields={fields} state={state} />
      </div>
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("saving") : submitLabel}
      </Button>
    </form>
  );
}

function EditForm({
  fields,
  item,
  action,
  onSaved,
}: {
  fields: FieldDef[];
  item: CatalogueItem;
  action: (s: FormState, f: FormData) => Promise<FormState>;
  onSaved: () => void;
}) {
  const t = useTranslations("common");
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  useEffect(() => {
    if (state?.ok) onSaved();
  }, [state, onSaved]);
  return (
    <form action={formAction} className="grid gap-4" noValidate>
      {state && !state.ok ? <FormAlert state={state} /> : null}
      <Fields fields={fields} state={state} defaults={item.values} />
      <Button type="submit" disabled={pending} className="justify-self-start">
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
