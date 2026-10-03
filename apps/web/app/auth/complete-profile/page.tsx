import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { CompleteProfileFlow } from "@/features/auth/components/complete-profile-flow";
import { SuspenseFallback } from "@/components/ui/suspense-fallback";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata.completeProfile");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function CompleteProfilePage() {
  return (
    <AuthSplitLayout>
      {/* The flow reads the stored grant on mount, and `useSearchParams`-free
          rendering still sits behind a boundary for consistent loading UX. */}
      <Suspense fallback={<SuspenseFallback />}>
        <CompleteProfileFlow />
      </Suspense>
    </AuthSplitLayout>
  );
}
