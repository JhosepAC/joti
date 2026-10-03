import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSplitLayout, LoginForm } from "@/features/auth";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.login");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  );
}
