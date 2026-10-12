import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";
import { migrationUrl } from "./src/env/schema";

loadEnvConfig(process.cwd());

const { DATABASE_URL, DATABASE_MIGRATION_URL } = process.env;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set (see .env.example)");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema",
  out: "./drizzle",
  dbCredentials: {
    url: migrationUrl({ DATABASE_URL, DATABASE_MIGRATION_URL }),
  },
  // Supabase owns auth/storage schemas; we only manage our own.
  schemaFilter: ["public", "app"],
  strict: true,
  verbose: true,
});
