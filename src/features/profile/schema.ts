import { z } from "zod";

// Messages are i18n keys under `errors.*` (messages/en.json).

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(120, { error: "tooLong" }),
  // E.164: '+', country code, subscriber number — matches the DB constraint.
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s()-]/g, ""))
    .pipe(
      z.union([
        z.literal(""),
        z.string().regex(/^\+[1-9][0-9]{6,14}$/, { error: "invalidPhone" }),
      ]),
    )
    .transform((v) => (v === "" ? null : v)),
});

export type ProfileInput = z.infer<typeof profileSchema>;
