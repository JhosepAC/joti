import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { ResetPasswordFlow } from "@/features/auth/components/reset-password-flow";
import { SuspenseFallback } from "@/components/ui/suspense-fallback";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.resetPassword");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout>
      <Suspense fallback={<SuspenseFallback />}>
        <ResetPasswordFlow />
      </Suspense>
    </AuthSplitLayout>
  );
}
