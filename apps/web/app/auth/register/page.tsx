import type { Metadata } from "next";
import { AuthSplitLayout, RegisterFlow } from "@/features/auth";

export const metadata: Metadata = {
  title: "Create Account - Joti",
  description: "Create your Joti account in 4 steps",
};

export default function RegisterPage() {
  return (
    <AuthSplitLayout>
      <RegisterFlow />
    </AuthSplitLayout>
  );
}
