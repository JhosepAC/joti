import type { Metadata } from "next";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { CompleteProfileFlow } from "@/features/auth/components/complete-profile-flow";

export const metadata: Metadata = {
  title: "Complete Profile - Joti",
  description: "Complete your Joti profile to continue",
};

export default function CompleteProfilePage() {
  return (
    <AuthSplitLayout>
      <CompleteProfileFlow />
    </AuthSplitLayout>
  );
}
