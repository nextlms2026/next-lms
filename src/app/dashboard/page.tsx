import { Suspense } from "react";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { listMyOrganizations } from "@/features/orgs/queries";

// Sign-in gated (see the (app) layout for why instant validation is off).
export const instant = false;

/**
 * Post-login router: no workspace → onboarding; one → open it; several → picker.
 * A page (not a route handler) so client-side navigations get a real URL change:
 * the router follows HTTP redirects from route handlers without updating the URL.
 */
async function RouteToHome(): Promise<never> {
  const orgs = await listMyOrganizations(); // redirects to /login when signed out
  if (orgs.length === 0) redirect("/onboarding");
  if (orgs.length === 1) redirect(`/o/${orgs[0]!.slug}`);
  redirect("/orgs");
}

export default function DashboardPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-6">
      <Suspense fallback={<Skeleton className="h-8 w-48" />}>
        <RouteToHome />
      </Suspense>
    </main>
  );
}
