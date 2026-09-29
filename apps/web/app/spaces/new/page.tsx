import type { Metadata } from "next";
import { AuthSplitLayout } from "@/features/auth/components/auth-split-layout";
import { NewSpaceOnboarding } from "@/features/spaces/components/new-space-onboarding";

export const metadata: Metadata = {
  title: "Tu primer espacio - Joti",
  description: "Crea el primer espacio de tu cuenta en Joti",
};

export default function NewSpacePage() {
  return (
    <AuthSplitLayout>
      <NewSpaceOnboarding />
    </AuthSplitLayout>
  );
}
