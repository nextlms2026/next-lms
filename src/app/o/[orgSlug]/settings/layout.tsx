import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/app-shell/settings-tabs";

export default async function SettingsLayout({
  children,
}: LayoutProps<"/o/[orgSlug]/settings">) {
  const t = await getTranslations("settings");
  return (
    <>
      <PageHeader title={t("title")} />
      <SettingsTabs />
      {children}
    </>
  );
}
