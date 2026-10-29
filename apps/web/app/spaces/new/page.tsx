import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { NewSpaceOnboarding } from "@/features/spaces/components/new-space-onboarding";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.spacesNew");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function NewSpacePage() {
  return <NewSpaceOnboarding />;
}
