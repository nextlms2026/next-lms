import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { GoogleSignIn } from "@/features/auth/components/google-sign-in";
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
      {/* useSearchParams (next) is request data → Suspense. */}
      <Suspense>
        <div className="grid gap-4">
          <GoogleSignIn />
          <SignUpForm />
        </div>
      </Suspense>
    </AuthCard>
  );
}
