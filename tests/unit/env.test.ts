import { describe, expect, it } from "vitest";
import { clientEnvSchema, migrationUrl, serverEnvSchema } from "@/env/schema";

const valid = {
  SUPABASE_SECRET_KEY: "sb_secret_abc",
  DATABASE_URL: "postgresql://u:p@host:6543/postgres",
  DATABASE_MIGRATION_URL: "postgresql://u:p@host:5432/postgres",
};

describe("serverEnvSchema", () => {
  it("accepts a valid configuration", () => {
    expect(serverEnvSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a publishable key placed in the secret slot", () => {
    const r = serverEnvSchema.safeParse({
      ...valid,
      SUPABASE_SECRET_KEY: "sb_publishable_abc",
    });
    expect(r.success).toBe(false);
  });

  it("rejects non-postgres database URLs", () => {
    const r = serverEnvSchema.safeParse({
      ...valid,
      DATABASE_URL: "https://example.com",
    });
    expect(r.success).toBe(false);
  });
});

describe("DATABASE_URL validation", () => {
  it("rejects a password with an unencoded '#'", () => {
    const r = serverEnvSchema.safeParse({
      ...valid,
      DATABASE_URL: "postgresql://u:pa#ss@host:6543/postgres",
    });
    expect(r.success).toBe(false);
  });

  it("accepts a percent-encoded password", () => {
    const r = serverEnvSchema.safeParse({
      ...valid,
      DATABASE_URL: "postgresql://u:p%40ss%23word@host:6543/postgres",
    });
    expect(r.success).toBe(true);
  });

  it("treats DATABASE_MIGRATION_URL as optional", () => {
    expect(
      serverEnvSchema.safeParse({ ...valid, DATABASE_MIGRATION_URL: undefined })
        .success,
    ).toBe(true);
  });
});

describe("migrationUrl", () => {
  it("prefers an explicit migration URL", () => {
    expect(
      migrationUrl({
        DATABASE_URL: "postgresql://u:p@host:6543/postgres",
        DATABASE_MIGRATION_URL: "postgresql://u:p@other:5432/postgres",
      }),
    ).toBe("postgresql://u:p@other:5432/postgres");
  });

  it("derives the session pooler (5432) from the transaction pooler (6543)", () => {
    expect(
      migrationUrl({ DATABASE_URL: "postgresql://u:p%40x@host:6543/postgres" }),
    ).toBe("postgresql://u:p%40x@host:5432/postgres");
  });
});

describe("NEXT_PUBLIC_GOOGLE_AUTH_ENABLED", () => {
  const base = {
    NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  };
  it("is off unless explicitly 'true'", () => {
    expect(clientEnvSchema.parse(base).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED).toBe(
      false,
    );
    expect(
      clientEnvSchema.parse({
        ...base,
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "false",
      }).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
    ).toBe(false);
    expect(
      clientEnvSchema.parse({
        ...base,
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
      }).NEXT_PUBLIC_GOOGLE_AUTH_ENABLED,
    ).toBe(true);
  });
  it("rejects typos instead of silently disabling", () => {
    expect(
      clientEnvSchema.safeParse({
        ...base,
        NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "yes",
      }).success,
    ).toBe(false);
  });
});
