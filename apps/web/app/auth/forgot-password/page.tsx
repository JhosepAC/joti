import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { ForgotPasswordFlow } from "@/features/auth/components/forgot-password-flow";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.forgotPassword");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout>
      <ForgotPasswordFlow />
    </AuthSplitLayout>
  );
}
