import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgot");
  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          {t("back")}
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
