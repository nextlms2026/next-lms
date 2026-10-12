import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const t = await getTranslations("auth.signIn");
  return (
    <AuthCard
      title={t("title")}
      description={t("description")}
      footer={
        <span>
          {t("noAccount")}{" "}
          <Link
            href="/signup"
            className="font-medium text-primary hover:underline"
          >
            {t("createAccount")}
          </Link>
        </span>
      }
    >
      {/* useSearchParams (next, error) is request data → Suspense. */}
      <Suspense>
        <SignInForm />
      </Suspense>
    </AuthCard>
  );
}
