import { z } from "zod";

// Messages are i18n keys under `errors.*` (messages/en.json).

const email = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "invalidEmail" }));

// bcrypt (used by Supabase Auth) ignores bytes beyond 72.
const newPassword = z
  .string()
  .min(8, { error: "passwordTooShort" })
  .max(72, { error: "passwordTooLong" });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "required" }),
});

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(1, { error: "required" })
    .max(120, { error: "tooLong" }),
  email,
  password: newPassword,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password: newPassword, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    error: "passwordsDontMatch",
    path: ["confirmPassword"],
  });

export const emailOtpTypeSchema = z.enum([
  "email",
  "signup",
  "recovery",
  "invite",
  "email_change",
]);
