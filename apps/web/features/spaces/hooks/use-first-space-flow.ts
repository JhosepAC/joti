"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { useLocale, useTranslations } from "next-intl";
import { api } from "@/convex/_generated/api";
import { defaultSpaceName } from "../catalog";
import { storeSpaceGrant } from "@/features/auth/utils/claim-store";
import { useAuthErrorMessage } from "@/features/auth/utils/get-auth-error-message";
import {
  FIRST_SPACE_TOTAL_STEPS,
  SPACE_ICON_DEFAULT,
  SPACE_ICON_CHOICES,
  SPACE_PURPOSE_KEYS,
  type FirstSpaceStep,
  type SpaceDraft,
  type SpaceIconChoice,
  type SpacePurposeKey,
  type SpaceTool,
} from "../types/space.types";
import {
  SPACE_NAME_MAX_LENGTH,
  sanitizeSpaceNameInput,
  validateSpaceNameInput,
} from "../validations/space.schema";

export function useFirstSpaceFlow(options: {
  email: string;
  claim: string;
  displayName: string | null;
  onReady: (slug: string) => void;
}) {
  const { email, claim, displayName, onReady } = options;
  const locale = useLocale();
  const submitting = useRef(false);

  const [step, setStep] = useState<FirstSpaceStep>(1);
  const draftKey = `nook:first-space:${email}`;
  const [draft, setDraft] = useState<SpaceDraft>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(draftKey) ?? "null");
      if (
        saved &&
        typeof saved.name === "string" &&
        SPACE_ICON_CHOICES.includes(saved.icon) &&
        SPACE_PURPOSE_KEYS.includes(saved.purpose)
      ) {
        return {
          name: sanitizeSpaceNameInput(saved.name).slice(
            0,
            SPACE_NAME_MAX_LENGTH,
          ),
          icon: saved.icon,
          purpose: saved.purpose,
        };
      }
    } catch {
      /* Storage can be unavailable; setup still works in memory. */
    }
    return {
      name: defaultSpaceName(displayName, SPACE_NAME_MAX_LENGTH, locale),
      icon: SPACE_ICON_DEFAULT,
      purpose: "personal",
    };
  });
  const [isCreating, setIsCreating] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    try {
      sessionStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {
      /* Optional draft recovery. */
    }
  }, [draft, draftKey]);

  const tErrors = useAuthErrorMessage();
  const tGeneral = useTranslations("errors");

  const createFirstSpace = useAction(api.spaces.actions.createFirstSpace);

  // The summary must show what will actually be created, so the tool list is
  // resolved by the server rather than hardcoded here.
  const purposePreview = useQuery(api.spaces.queries.getPurposePreview, {
    purpose: draft.purpose,
  });

  useEffect(() => {
    // Only prefills while the field is untouched, so it can never overwrite
    // something the user typed.
    setDraft((prev) => {
      const untouched =
        prev.name === defaultSpaceName(null, SPACE_NAME_MAX_LENGTH, locale);
      if (!untouched && prev.name.trim().length > 0) return prev;
      return {
        ...prev,
        name: defaultSpaceName(displayName, SPACE_NAME_MAX_LENGTH, locale),
      };
    });
  }, [displayName, locale]);

  const tNameError = useTranslations("spaces.identity.nameError");

  const nameProblem = useMemo(
    () =>
      validateSpaceNameInput(draft.name, (key, vars) =>
        tNameError(key as never, vars as never),
      ),
    [draft.name, tNameError],
  );

  // Live feedback: nothing is shown for an empty field (the requirement hint is
  // enough), but an out-of-range value is reported as it is typed.
  const nameError =
    draft.name.length > 0 ? (nameProblem ?? undefined) : undefined;

  // "Next" is only reachable once the current step is actually valid, so an
  // incomplete step cannot be submitted or skipped past.
  const canGoNext = step === 1 ? nameProblem === null : true;

  const setName = useCallback((value: string) => {
    setDraft((prev) => ({
      ...prev,
      // Control characters are stripped rather than merely rejected, and the
      // length is clamped, so an invalid value can never reach the field.
      name: sanitizeSpaceNameInput(value).slice(0, SPACE_NAME_MAX_LENGTH),
    }));
  }, []);

  const setIcon = useCallback((icon: SpaceIconChoice) => {
    setDraft((prev) => ({ ...prev, icon }));
  }, []);

  const setPurpose = useCallback((purpose: SpacePurposeKey) => {
    setDraft((prev) => ({ ...prev, purpose }));
  }, []);

  const goNext = useCallback(() => {
    if (submitting.current) return;
    if (step === 1) {
      if (nameProblem !== null) return;
      setStep(2);
      return;
    }
    if (step === 2) {
      setStep(3);
    }
  }, [nameProblem, step]);

  const goBack = useCallback(() => {
    if (submitting.current) return;
    if (step > 1) setStep((prev) => (prev - 1) as FirstSpaceStep);
  }, [step]);

  const goToStep = useCallback(
    (target: number) => {
      if (submitting.current || target < 1 || target > 3) return;
      if (target > 1 && nameProblem !== null) return;
      setStep(target as FirstSpaceStep);
    },
    [nameProblem],
  );

  const submit = useCallback(async () => {
    if (submitting.current) return;
    // Re-checked here because step 1 can have been edited after advancing.
    if (nameProblem !== null) {
      setStep(1);
      return;
    }
    setIsCreating(true);
    submitting.current = true;
    setGeneralError(null);

    try {
      const result = await createFirstSpace({
        email,
        claim,
        name: draft.name.trim(),
        icon: draft.icon,
        purpose: draft.purpose,
      });

      storeSpaceGrant(result.slug, result.spaceGrant);
      try {
        sessionStorage.removeItem(draftKey);
      } catch {
        /* Do not delay successful creation. */
      }

      onReady(result.slug);
    } catch (err: unknown) {
      submitting.current = false;
      setIsCreating(false);
      setGeneralError(tErrors(err, tGeneral("createSpaceFailed")));
    }
  }, [
    claim,
    createFirstSpace,
    draft.icon,
    draft.name,
    draft.purpose,
    draftKey,
    email,
    nameProblem,
    onReady,
  ]);

  const tools: SpaceTool[] = purposePreview ? purposePreview.tools : [];

  return {
    step,
    totalSteps: FIRST_SPACE_TOTAL_STEPS,
    canGoBack: step > 1,
    canGoNext,
    draft,
    nameError,
    generalError,
    isCreating,
    tools,
    isLoadingTools: purposePreview === undefined,
    setName,
    setIcon,
    setPurpose,
    goNext,
    goBack,
    goToStep,
    submit,
  };
}
