"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SpaceStepIndicator } from "./space-step-indicator";
import { SpaceIdentityStep } from "./space-identity-step";
import { SpacePurposeStep } from "./space-purpose-step";
import { SpaceSummaryStep } from "./space-summary-step";
import { CreatingSpaceModal } from "./creating-space-modal";
import { ArrowRightIcon } from "./icons";
import { useFirstSpaceFlow } from "../hooks/use-first-space-flow";

interface Props {
  email: string;
  claim: string;
  displayName: string | null;
}

/**
 * First-space onboarding.
 *
 * The caller has already been through the entry gate, so the account exists, the
 * profile is complete and no space exists yet. All three are enforced again on
 * the server, so this component never has to decide whether the user may be here.
 */
export const FirstSpaceFlow: React.FC<Props> = ({ email, claim, displayName }) => {
  const router = useRouter();
  const flow = useFirstSpaceFlow({
    email,
    claim,
    displayName,
    onReady: (slug) => {
      router.replace(`/w/${slug}`);
    },
  });

  return (
    <div className="mx-auto w-full max-w-[460px] py-8">
      <header className="mb-7">
        <h1 className="text-3xl font-semibold tracking-[-0.03em] text-text-primary font-heading leading-tight md:text-[2.25rem]">
          Crea tu primer espacio
        </h1>
        <p className="mt-2 text-[0.95rem] font-light text-text-secondary">
          Todo en Joti vive dentro de un espacio. Empecemos por el primero.
        </p>
      </header>

      <SpaceStepIndicator
        current={flow.step}
        total={flow.totalSteps}
        canGoBack={flow.canGoBack && !flow.isCreating}
        onBack={flow.goBack}
      />

      {flow.generalError && (
        <div className="mb-5 rounded-2xl border border-error/20 bg-red-50 p-3.5 text-xs text-error">
          {flow.generalError}
        </div>
      )}

      {flow.step === 1 && (
        <SpaceIdentityStep
          draft={flow.draft}
          nameError={flow.nameError}
          onNameChange={flow.setName}
          onIconChange={flow.setIcon}
        />
      )}

      {flow.step === 2 && (
        <SpacePurposeStep value={flow.draft.purpose} onChange={flow.setPurpose} />
      )}

      {flow.step === 3 && (
        <SpaceSummaryStep
          draft={flow.draft}
          tools={flow.tools}
          isLoadingTools={flow.isLoadingTools}
          isCreating={flow.isCreating}
          onSubmit={() => void flow.submit()}
        />
      )}

      {flow.step < 3 && (
        <div className="mt-7 flex justify-end">
          <Button
            type="button"
            variant="primary"
            className="h-12 gap-2 rounded-full px-7"
            onClick={flow.goNext}
            disabled={!flow.canGoNext}
          >
            Siguiente
            <ArrowRightIcon className="text-base" />
          </Button>
        </div>
      )}

      {flow.showCreating && <CreatingSpaceModal message={flow.message} />}
    </div>
  );
};
