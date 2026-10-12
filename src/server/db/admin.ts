import "server-only";
import { getClient } from "./client";

/**
 * RLS-BYPASSING database access. Only for the call sites listed in
 * docs/SECURITY.md → "Admin client". Adding a caller requires updating that list.
 */
export function getAdminDb() {
  return getClient();
}
