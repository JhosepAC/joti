import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { CompleteProfileFlow } from "@/features/auth/components/complete-profile-flow";

export const metadata: Metadata = {
  title: "Complete Profile - Joti",
  description: "Complete your Joti profile to continue",
};

export default function CompleteProfilePage() {
  return (
    <AuthSplitLayout>
      {/* The flow reads `?email=` to know which account is being completed, and
          `useSearchParams` opts the page out of static prerendering, so it has to
          sit behind a boundary. */}
      <Suspense fallback={<div className="w-full max-w-[460px] mx-auto py-8 text-sm text-text-secondary">Loading...</div>}>
        <CompleteProfileFlow />
      </Suspense>
    </AuthSplitLayout>
  );
}
