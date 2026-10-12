import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Check your email" };

export default async function CheckEmailPage() {
  const t = await getTranslations("auth.checkEmail");
  return (
    <AuthCard title={t("title")} description={t("description")}>
      <div className="grid gap-4">
        <MailCheck className="size-10 text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">{t("spam")}</p>
        <Button asChild variant="outline">
          <Link href="/login">{t("back")}</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
