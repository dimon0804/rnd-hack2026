import { getTranslations } from "next-intl/server";
import { HubClient } from "@/components/HubClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return { title: t("title") };
}

export default function HubPage() {
  return <HubClient />;
}
