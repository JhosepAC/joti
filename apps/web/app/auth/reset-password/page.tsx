import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { ResetPasswordFlow } from "@/features/auth/components/reset-password-flow";

export const metadata: Metadata = {
  title: "Reset Password - Joti",
  description: "Choose a new password for your Joti account",
};

export default function ResetPasswordPage() {
  return (
    <AuthSplitLayout>
      <Suspense fallback={<div className="w-full max-w-[460px] mx-auto py-8 text-sm text-text-secondary">Loading...</div>}>
        <ResetPasswordFlow />
      </Suspense>
    </AuthSplitLayout>
  );
}
