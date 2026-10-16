import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthCard } from "@/components/auth-card";
import { getVerifiedClaims } from "@/server/auth";
import { acceptInvitationByToken } from "@/features/team/actions";
import { getInvitationPreview } from "@/features/team/queries";
import { AcceptInvitationButton } from "@/features/team/components/accept-invitation";
import { signOut } from "@/features/auth/actions";
import { GoogleSignIn } from "@/features/auth/components/google-sign-in";

export const metadata: Metadata = {
  title: "Invitation",
  // Invite links are secrets: keep them out of search engines and referrers.
  robots: { index: false, follow: false },
};
export const instant = false;

async function Invitation({
  params,
}: {
  params: PageProps<"/invite/[token]">["params"];
}) {
  const { token } = await params;
  const [t, tr, preview, claims] = await Promise.all([
    getTranslations("team.accept"),
    getTranslations("orgs.roles"),
    getInvitationPreview(token),
    getVerifiedClaims(),
  ]);

  if (!preview || preview.status !== "pending") {
    const key = preview ? preview.status : "invalid";
    return (
      <AuthCard
        title={t(`status.${key}.title`)}
        description={t(`status.${key}.body`)}
      >
        <Button asChild variant="outline" className="w-full">
          <Link href="/dashboard">{t("home")}</Link>
        </Button>
      </AuthCard>
    );
  }

  const next = encodeURIComponent(`/invite/${token}`);
  const title = t("title", { org: preview.orgName });
  const description = t("description", {
    role: tr(preview.role),
    email: preview.emailMasked,
  });

  if (!claims) {
    return (
      <AuthCard title={title} description={description}>
        <div className="grid gap-3">
          <p className="text-sm text-muted-foreground">{t("signInFirst")}</p>
          <GoogleSignIn next={`/invite/${token}`} />
          <Button asChild size="lg">
            <Link href={`/login?next=${next}`}>{t("signIn")}</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href={`/signup?next=${next}`}>{t("createAccount")}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  const signedInAs = typeof claims.email === "string" ? claims.email : "";
  return (
    <AuthCard title={title} description={description}>
      <div className="grid gap-4">
        <p className="text-sm text-muted-foreground">
          {t("signedInAs", { email: signedInAs })}
        </p>
        <AcceptInvitationButton
          action={acceptInvitationByToken.bind(null, token)}
        />
        <form action={signOut}>
          <input type="hidden" name="next" value={`/invite/${token}`} />
          <Button type="submit" variant="ghost" className="w-full">
            {t("switchAccount")}
          </Button>
        </form>
      </div>
    </AuthCard>
  );
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <Suspense fallback={<Skeleton className="h-72 w-full rounded-xl" />}>
      <Invitation params={params} />
    </Suspense>
  );
}
