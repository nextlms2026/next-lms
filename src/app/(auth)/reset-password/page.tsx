import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";
import { requireUser } from "@/server/authz";

export const metadata: Metadata = { title: "Choose a new password" };

// Reached from the recovery email link, which signs the user in first.
async function RequireRecoverySession({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return children;
}

export default async function ResetPasswordPage() {
  const t = await getTranslations("auth.reset");
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <Suspense>
        <RequireRecoverySession>
          <ResetPasswordForm />
        </RequireRecoverySession>
      </Suspense>
    </AuthCard>
  );
}
