import { getMyProfile } from "@/features/profile/queries";
import { Skeleton } from "@/components/ui/skeleton";
import { UserMenu } from "./user-menu";

/** Server wrapper: reads the profile (session data) — render inside <Suspense>. */
export async function AccountButton() {
  const profile = await getMyProfile();
  return <UserMenu name={profile.fullName} email={profile.email} />;
}

export function AccountButtonSkeleton() {
  return <Skeleton className="size-9 rounded-full" />;
}
