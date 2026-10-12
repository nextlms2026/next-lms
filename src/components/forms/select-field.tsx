"use client";

import { useId, type ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { describedBy, FieldShell } from "./form-field";

export type SelectOption = { value: string; label: string };

type SelectFieldProps = Omit<ComponentProps<"select">, "id" | "children"> & {
  name: string;
  label: string;
  options: readonly SelectOption[];
  hint?: string;
  error?: string;
};

/**
 * Native <select>: accessible, works without JS, and uses the OS picker on
 * phones — better than a custom combobox for long lists like time zones.
 */
export function SelectField({
  name,
  label,
  options,
  hint,
  error,
  className,
  ...selectProps
}: SelectFieldProps) {
  const id = `${useId()}-${name}`;
  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      error={error}
      className={className}
    >
      <select
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(
          "h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2.5 text-base shadow-xs transition-[color,box-shadow] outline-none md:text-sm",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
          "disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30",
        )}
        {...selectProps}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldShell>
  );
}
