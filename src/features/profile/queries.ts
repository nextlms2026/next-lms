import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/server/db";
import { profiles } from "@/server/db/schema";
import { requireUser } from "@/server/authz";

export async function getMyProfile() {
  const user = await requireUser();
  const [row] = await db.rls((tx) =>
    tx
      .select({ fullName: profiles.fullName, phone: profiles.phone })
      .from(profiles)
      .where(eq(profiles.id, user.id)),
  );
  return {
    email: user.email,
    fullName: row?.fullName ?? "",
    phone: row?.phone ?? null,
  };
}
