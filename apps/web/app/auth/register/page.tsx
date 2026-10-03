import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSplitLayout, RegisterFlow } from "@/features/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.register");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function RegisterPage() {
  return (
    <AuthSplitLayout>
      <RegisterFlow />
    </AuthSplitLayout>
  );
}
