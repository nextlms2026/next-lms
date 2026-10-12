import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import {
  AccountButton,
  AccountButtonSkeleton,
} from "@/components/app-shell/account-button";

// Sign-in gated: the auth redirect can never pass dev-time instant-navigation
// validation, so opt out of its feedback (content still streams behind Suspense).
export const instant = false;

/** Signed-in pages outside a workspace: onboarding, workspace picker, account. */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center justify-between px-4 sm:px-6">
          <Logo href="/dashboard" />
          <Suspense fallback={<AccountButtonSkeleton />}>
            <AccountButton />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
