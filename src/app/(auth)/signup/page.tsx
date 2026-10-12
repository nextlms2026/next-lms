import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  const t = await getTranslations("auth.signUp");
  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <span>
          {t("haveAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            {(await getTranslations("auth.signIn"))("submit")}
          </Link>
        </span>
      }
    >
      <SignUpForm />
    </AuthCard>
  );
}
