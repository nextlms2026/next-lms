"use client";

import { useId, type ComponentProps, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldShellProps = {
  id: string;
  label: string;
  hint?: string;
  /** Message key under `errors.*` */
  error?: string;
  className?: string;
  children: ReactNode;
};

/** Label + control + hint/error, wired with aria attributes. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  className,
  children,
}: FieldShellProps) {
  const t = useTranslations("errors");
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function describedBy(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

type FormFieldProps = Omit<ComponentProps<typeof Input>, "id"> & {
  name: string;
  label: string;
  hint?: string;
  error?: string;
};

export function FormField({
  name,
  label,
  hint,
  error,
  className,
  ...inputProps
}: FormFieldProps) {
  const id = `${useId()}-${name}`;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        {...inputProps}
      />
    </FieldShell>
  );
}
