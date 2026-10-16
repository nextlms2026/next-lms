import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

// @next/env skips .env.local under NODE_ENV=test; load it explicitly.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required for E2E tests (.env.local)`);
  return v;
}

const authAdmin = () =>
  createClient(
    required("NEXT_PUBLIC_SUPABASE_URL"),
    required("SUPABASE_SECRET_KEY"),
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  ).auth.admin;

export type E2EUser = {
  id: string;
  email: string;
  password: string;
  fullName: string;
};

/** Confirmed user created through the Auth admin API (no email is sent). */
export async function createE2EUser(
  label: string,
  fullName = "Esha Example",
): Promise<E2EUser> {
  const email = `e2e-${randomUUID().slice(0, 8)}-${label}@example.com`;
  const password = `Pw-${randomUUID()}`;
  const { data, error } = await authAdmin().createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return { id: data.user.id, email, password, fullName };
}

/** Removes orgs the user created (memberships cascade), then the user. */
export async function deleteE2EUser(user: E2EUser) {
  const sql = postgres(required("DATABASE_URL"), { prepare: false, max: 1 });
  try {
    await sql`delete from public.organizations where created_by = ${user.id}`;
  } finally {
    await sql.end();
  }
  await authAdmin().deleteUser(user.id);
}

/** Creates a workspace owned by `owner` through the real SQL function (as that user). */
export async function createE2EOrg(owner: E2EUser, name: string) {
  const slug = `e2e-${randomUUID().slice(0, 8)}`;
  const sql = postgres(required("DATABASE_URL"), { prepare: false, max: 1 });
  try {
    await sql.begin(async (tx) => {
      const claims = JSON.stringify({ sub: owner.id, role: "authenticated" });
      await tx`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`;
      await tx`select app.create_organization(
        ${name}, ${slug}, 'institute', 'LK', 'Asia/Colombo', 'LKR', 'en-LK', 1::smallint)`;
    });
  } finally {
    await sql.end();
  }
  return { slug, name };
}
