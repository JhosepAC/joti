import type { Metadata } from "next";
import { AuthSplitLayout, LoginForm } from "@/features/auth";

export const metadata: Metadata = {
  title: "Sign In - Joti",
  description: "Sign in to access your Joti dashboard",
};

export default function LoginPage() {
  return (
    <AuthSplitLayout>
      <LoginForm />
    </AuthSplitLayout>
  );
}
