import { z } from "zod";

export const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url(),
  // Shows "Continue with Google" once the provider is configured in Supabase.
  NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
});

const postgresUrl = z
  .string()
  .regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string")
  .refine(
    (v) => {
      try {
        // An unencoded '#' in the password truncates the URL into a fragment.
        return new URL(v).hash === "";
      } catch {
        return false;
      }
    },
    {
      message:
        "is not a valid URL — percent-encode special characters in the password (@ → %40, # → %23)",
    },
  );

export const serverEnvSchema = z.object({
  SUPABASE_SECRET_KEY: z
    .string()
    .min(1)
    .refine((v) => !v.startsWith("sb_publishable_"), {
      message: "must be the secret key, not the publishable key",
    }),
  DATABASE_URL: postgresUrl,
  // Optional: defaults to DATABASE_URL on the session-pooler port (see migrationUrl).
  DATABASE_MIGRATION_URL: postgresUrl.optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * Connection string for migrations and scripts. Supabase's transaction pooler (6543)
 * can't run migrations; the session pooler is the same host/user/password on 5432.
 */
export function migrationUrl(env: {
  DATABASE_URL: string;
  DATABASE_MIGRATION_URL?: string | undefined;
}): string {
  if (env.DATABASE_MIGRATION_URL) return env.DATABASE_MIGRATION_URL;
  const url = new URL(env.DATABASE_URL);
  if (url.port === "6543") url.port = "5432";
  return url.toString();
}
