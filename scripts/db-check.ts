/**
 * Verifies .env.local against the Supabase project without changing anything:
 *   - env vars are present and well-formed
 *   - publishable and secret API keys are accepted
 *   - both database URLs connect
 *   - the RLS context switch used by db.rls works (role + auth.uid())
 *   - outgoing email (if configured) can log in to the SMTP server
 * Run: npm run db:check
 */
import { loadEnvConfig } from "@next/env";
import nodemailer from "nodemailer";
import postgres from "postgres";
import {
  clientEnvSchema,
  emailEnvSchema,
  migrationUrl,
  serverEnvSchema,
} from "../src/env/schema";
import { toRlsSettings } from "../src/server/db/rls-settings";

loadEnvConfig(process.cwd());

let failed = false;
const ok = (msg: string) => console.log(`  ✔ ${msg}`);
const fail = (msg: string) => {
  failed = true;
  console.log(`  ✘ ${msg}`);
};

async function main() {
  console.log("Environment");
  const client = clientEnvSchema.safeParse(process.env);
  const server = serverEnvSchema.safeParse(process.env);
  for (const r of [client, server]) {
    if (!r.success) {
      for (const issue of r.error.issues)
        fail(`${issue.path.join(".")}: ${issue.message}`);
    }
  }
  if (!client.success || !server.success) return;
  ok("all variables present and well-formed");

  const {
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pub,
  } = client.data;
  const {
    SUPABASE_SECRET_KEY: secret,
    DATABASE_URL,
    DATABASE_MIGRATION_URL: explicitMigrationUrl,
  } = server.data;

  console.log("Supabase API");
  const pubRes = await fetch(`${url}/auth/v1/settings`, {
    headers: { apikey: pub },
  });
  if (pubRes.ok) ok("publishable key accepted");
  else fail(`publishable key rejected (HTTP ${pubRes.status})`);

  const secretRes = await fetch(`${url}/auth/v1/admin/users?per_page=1`, {
    headers: { apikey: secret, Authorization: `Bearer ${secret}` },
  });
  if (secretRes.ok) ok("secret key accepted");
  else fail(`secret key rejected (HTTP ${secretRes.status})`);

  console.log("Database");
  for (const [name, dbUrl] of [
    ["DATABASE_URL (transaction pooler)", DATABASE_URL],
    [
      explicitMigrationUrl
        ? "DATABASE_MIGRATION_URL (session pooler)"
        : "session pooler (derived from DATABASE_URL, port 5432)",
      migrationUrl({
        DATABASE_URL,
        DATABASE_MIGRATION_URL: explicitMigrationUrl,
      }),
    ],
  ] as const) {
    const sql = postgres(dbUrl, {
      prepare: false,
      max: 1,
      connect_timeout: 10,
    });
    try {
      const [row] = await sql<{ version: string }[]>`select version()`;
      ok(`${name} connects (${row?.version.split(",")[0]})`);
    } catch (e) {
      fail(`${name} failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      await sql.end();
    }
  }

  console.log("RLS context switch");
  const sql = postgres(DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });
  try {
    const fakeSub = "00000000-0000-4000-8000-000000000001";
    const { role, claimsJson } = toRlsSettings({
      sub: fakeSub,
      role: "authenticated",
    });
    const [row] = await sql.begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${claimsJson}, true), set_config('role', ${role}, true)`;
      return tx<
        { current_user: string; uid: string | null }[]
      >`select current_user, auth.uid()::text as uid`;
    });
    if (row?.current_user === "authenticated" && row.uid === fakeSub) {
      ok("transaction runs as 'authenticated' with auth.uid() set");
    } else {
      fail(`unexpected context: ${JSON.stringify(row)}`);
    }
    const [after] = await sql<{ current_user: string }[]>`select current_user`;
    if (after?.current_user !== "authenticated")
      ok(`role resets after commit (${after?.current_user})`);
    else fail("role leaked outside the transaction");
  } catch (e) {
    fail(`RLS switch failed: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    await sql.end();
  }

  console.log("Email");
  const email = emailEnvSchema.safeParse(process.env);
  if (!email.success) {
    for (const issue of email.error.issues)
      fail(`${issue.path.join(".")}: ${issue.message}`);
  } else if (email.data.EMAIL_TRANSPORT !== "smtp") {
    ok("not configured — invitations are shared as links (optional)");
  } else {
    // Connects and authenticates only; sends nothing.
    const transporter = nodemailer.createTransport({
      host: email.data.SMTP_HOST,
      port: email.data.SMTP_PORT,
      secure: email.data.SMTP_PORT === 465,
      auth: { user: email.data.SMTP_USER, pass: email.data.SMTP_PASSWORD },
    });
    try {
      await transporter.verify();
      ok(`SMTP login works (${email.data.SMTP_HOST}:${email.data.SMTP_PORT})`);
    } catch (e) {
      const { code, responseCode } = e as {
        code?: string;
        responseCode?: number;
      };
      fail(
        `SMTP login failed (${code ?? ""} ${responseCode ?? ""}) — for Gmail use an App password, not the account password`,
      );
    }
  }
}

main()
  .catch((e) => fail(e instanceof Error ? e.message : String(e)))
  .finally(() => {
    console.log(failed ? "\nSome checks failed." : "\nAll checks passed.");
    process.exit(failed ? 1 : 0);
  });
