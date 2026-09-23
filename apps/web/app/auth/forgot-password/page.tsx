import type { Metadata } from "next";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { ForgotPasswordFlow } from "@/features/auth/components/forgot-password-flow";

export const metadata: Metadata = {
  title: "Forgot Password - Joti",
  description: "Reset your Joti password",
};

export default function ForgotPasswordPage() {
  return (
    <AuthSplitLayout>
      <ForgotPasswordFlow />
    </AuthSplitLayout>
  );
}
