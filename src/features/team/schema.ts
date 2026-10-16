import { z } from "zod";

// Messages are i18n keys under `errors.*` (messages/en.json).

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "invalidEmail" }).max(254, { error: "tooLong" })),
  // Owners are never invited (ownership is granted by promotion).
  role: z.enum(["admin", "teacher"], { error: "required" }),
});

export const memberRoleSchema = z.enum(["owner", "admin", "teacher"]);
export const memberStatusSchema = z.enum(["active", "inactive"]);
export const uuidSchema = z.uuid();
