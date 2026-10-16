import type { z } from "zod";

/**
 * Result of a form Server Action used with `useActionState`.
 * `error` and `fieldErrors` hold message keys under `errors.*` in messages/en.json,
 * never raw database or auth errors.
 */
export type FormState =
  | { ok: true; message?: string; data?: Record<string, string> }
  | {
      ok: false;
      error?: string;
      fieldErrors?: Record<string, string>;
      values?: Record<string, string>;
    }
  | null;

/** First issue per field, as message keys (schemas use keys as their messages). */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}

/** Echo non-secret inputs back so the form keeps them after a failed submit. */
export function echoValues(
  formData: FormData,
  fields: readonly string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = formData.get(f);
    if (typeof v === "string") out[f] = v;
  }
  return out;
}
