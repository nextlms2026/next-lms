/**
 * RLS test harness. Runs queries against the dev Supabase project exactly as
 * `db.rls` does (role + JWT claims per transaction), using fixtures created
 * for this run only and removed afterwards. See docs/SECURITY.md → testing.
 */
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { toRlsSettings } from "@/server/db/rls-settings";

// @next/env skips .env.local when NODE_ENV=test, so load it explicitly.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for RLS tests (.env.local)`);
  return v;
}

export const runId = randomUUID().slice(0, 8);

/** Privileged connection — fixtures and cleanup only. */
export const adminSql = postgres(required("DATABASE_URL"), {
  prepare: false,
  max: 2,
  onnotice: () => {},
});

const authAdmin = createClient(
  required("NEXT_PUBLIC_SUPABASE_URL"),
  required("SUPABASE_SECRET_KEY"),
  { auth: { persistSession: false, autoRefreshToken: false } },
).auth.admin;

export type TestUser = { id: string; email: string };
const createdUsers: string[] = [];

export async function createUser(label: string): Promise<TestUser> {
  const email = `rls-${runId}-${label}@example.com`;
  const { data, error } = await authAdmin.createUser({
    email,
    password: `Pw-${randomUUID()}`,
    email_confirm: true,
    user_metadata: { full_name: `Test ${label}` },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}

type Tx = postgres.TransactionSql;

/** Run `fn` as the given user (or anon when null), like db.rls. Always rolls back. */
export async function as<T>(
  user: TestUser | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const { role, claimsJson } = toRlsSettings(
    user ? { sub: user.id, role: "authenticated" } : null,
  );
  let result: T | undefined;
  const rollback = new Error("rollback");
  await adminSql
    .begin(async (tx) => {
      await tx`select set_config('request.jwt.claims', ${claimsJson}, true), set_config('role', ${role}, true)`;
      result = await fn(tx);
      throw rollback; // keep every test side-effect free
    })
    .catch((e: unknown) => {
      if (e !== rollback) throw e;
    });
  return result as T;
}

/** Like `as`, but commits — for building fixtures through the real code path. */
export async function asCommit<T>(
  user: TestUser,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  const { role, claimsJson } = toRlsSettings({
    sub: user.id,
    role: "authenticated",
  });
  return adminSql.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${claimsJson}, true), set_config('role', ${role}, true)`;
    return fn(tx);
  }) as Promise<T>;
}

export async function createOrg(owner: TestUser, label: string) {
  const slug = `t-${runId}-${label}`;
  const [row] = await asCommit(
    owner,
    (tx) =>
      tx<{ id: string }[]>`select app.create_organization(
        ${`Org ${label}`}, ${slug}, 'institute', 'LK', 'Asia/Colombo', 'LKR', 'en-LK', 1::smallint
      ) as id`,
  );
  if (!row) throw new Error("createOrg failed");
  return { id: row.id, slug };
}

/** Fixture-only: add a member directly (invitations arrive in M3). */
export async function addMember(
  orgId: string,
  user: TestUser,
  role: "owner" | "admin" | "teacher",
) {
  await adminSql`insert into public.memberships (org_id, user_id, role) values (${orgId}, ${user.id}, ${role})`;
}

export async function cleanup() {
  // Deleting orgs cascades memberships; then auth users cascade profiles.
  await adminSql`delete from public.organizations where slug like ${`t-${runId}-%`}`;
  for (const id of createdUsers) await authAdmin.deleteUser(id);
  await adminSql.end();
}

/** Postgres error code of a rejected promise (e.g. 42501 insufficient_privilege). */
export async function errorCode(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
}
