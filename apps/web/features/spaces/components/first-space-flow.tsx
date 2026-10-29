"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SpaceOnboardingShell } from "./space-onboarding-shell";
import { SpacePreviewCard } from "./space-preview-card";
import { SpaceIdentityStep } from "./space-identity-step";
import { SpacePurposeStep } from "./space-purpose-step";
import { SpaceSummaryStep } from "./space-summary-step";
import { CreatingSpaceStatus } from "./creating-space-status";
import { ArrowLeftIcon, ArrowRightIcon } from "./icons";
import { useFirstSpaceFlow } from "../hooks/use-first-space-flow";

export function FirstSpaceFlow({
  email,
  claim,
  displayName,
}: {
  email: string;
  claim: string;
  displayName: string | null;
}) {
  const router = useRouter();
  const t = useTranslations("spaces");
  const flow = useFirstSpaceFlow({
    email,
    claim,
    displayName,
    onReady: (slug) => router.replace(`/w/${slug}`),
  });
  const region = useRef<HTMLFormElement>(null);
  const previousStep = useRef(flow.step);
  const direction = flow.step >= previousStep.current ? "forward" : "back";
  useEffect(() => {
    if (previousStep.current !== flow.step)
      region.current
        ?.querySelector<HTMLHeadingElement>("h1")
        ?.focus({ preventScroll: true });
    previousStep.current = flow.step;
  }, [flow.step]);
  const purposeTitle = t(`purpose.options.${flow.draft.purpose}.title`);
  return (
    <SpaceOnboardingShell
      step={flow.step}
      totalSteps={flow.totalSteps}
      onStepChange={flow.goToStep}
      isCreating={flow.isCreating}
      preview={
        <SpacePreviewCard
          icon={flow.draft.icon}
          name={flow.draft.name.trim()}
          purpose={flow.draft.purpose}
          purposeLabel={purposeTitle}
          tools={flow.tools}
          isLoadingTools={flow.isLoadingTools}
        />
      }
    >
      <form
        ref={region}
        onSubmit={(event) => {
          event.preventDefault();
          if (flow.step < 3) flow.goNext();
          else void flow.submit();
        }}
        aria-busy={flow.isCreating}
      >
        <fieldset className="setup-fields" disabled={flow.isCreating}>
          <div
            key={flow.step}
            className="setup-step"
            data-direction={direction}
          >
            {flow.step === 1 && (
              <SpaceIdentityStep
                draft={flow.draft}
                nameError={flow.nameError}
                onNameChange={flow.setName}
                onIconChange={flow.setIcon}
              />
            )}
            {flow.step === 2 && (
              <SpacePurposeStep
                value={flow.draft.purpose}
                onChange={flow.setPurpose}
              />
            )}
            {flow.step === 3 && (
              <SpaceSummaryStep
                draft={flow.draft}
                purposeLabel={purposeTitle}
                tools={flow.tools}
                onEdit={flow.goToStep}
              />
            )}
          </div>
          {flow.generalError && (
            <div className="setup-error" role="alert">
              <p>{flow.generalError}</p>
            </div>
          )}
          <div className="setup-actions">
            <button
              type="button"
              className="setup-back"
              onClick={flow.goBack}
              disabled={!flow.canGoBack}
              style={{ visibility: flow.canGoBack ? "visible" : "hidden" }}
            >
              <ArrowLeftIcon />
              {t("onboarding.back")}
            </button>
            <button
              type="submit"
              className="setup-primary"
              disabled={!flow.canGoNext || flow.isLoadingTools}
            >
              {flow.isCreating
                ? t("creating.title")
                : flow.step === 3
                  ? t("summary.submit")
                  : t("onboarding.next")}
              <ArrowRightIcon />
            </button>
          </div>
        </fieldset>
        {flow.isCreating && <CreatingSpaceStatus />}
      </form>
    </SpaceOnboardingShell>
  );
}
