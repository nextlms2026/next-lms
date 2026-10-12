import { getTranslations } from "next-intl/server";

export default async function Home() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-4 px-6 py-24">
      <h1 className="text-3xl font-semibold tracking-tight">{t("app.name")}</h1>
      <p className="text-lg text-muted-foreground">{t("app.tagline")}</p>
      <p className="text-sm text-muted-foreground">{t("home.comingSoon")}</p>
    </main>
  );
}
