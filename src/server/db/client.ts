import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { serverEnv } from "@/env/server";
import * as schema from "./schema";

/**
 * Raw privileged connection. Do NOT import this outside src/server/db/.
 * Use `db.rls` (index.ts) for request-scoped work, `dbAdmin` (admin.ts) only for
 * the call sites listed in docs/SECURITY.md.
 */
function createClient() {
  const sql = postgres(serverEnv.DATABASE_URL, {
    // Supabase transaction pooler does not support prepared statements.
    prepare: false,
    max: 5,
  });
  return drizzle(sql, { schema });
}

type Client = ReturnType<typeof createClient>;

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __nextlmsDb?: Client };

export function getClient(): Client {
  globalForDb.__nextlmsDb ??= createClient();
  return globalForDb.__nextlmsDb;
}

export type Transaction = Parameters<Parameters<Client["transaction"]>[0]>[0];
